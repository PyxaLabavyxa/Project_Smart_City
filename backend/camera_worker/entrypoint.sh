#!/bin/sh
set -eu
# Fail closed. No private destinations, even through DNS rebinding, HLS segments,
# ONVIF responses or RTSP redirects. The worker has no database or media volume.
iptables -P OUTPUT DROP
iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
# Docker DNAT changes destination port 53 before OUTPUT filtering. Match the
# conntrack original port, otherwise DNS works by IP only and every hostname fails.
iptables -A OUTPUT -d 127.0.0.11 -p udp -m conntrack --ctorigdstport 53 -j ACCEPT
iptables -A OUTPUT -d 127.0.0.11 -p tcp -m conntrack --ctorigdstport 53 -j ACCEPT
# Docker healthcheck runs as root; the media process loses all capabilities and UID 0.
iptables -A OUTPUT -d 127.0.0.1 -p tcp --dport 8001 -m owner --uid-owner 0 -j ACCEPT
for network in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.0.0.0/24 192.0.2.0/24 192.88.99.0/24 192.168.0.0/16 198.18.0.0/15 198.51.100.0/24 203.0.113.0/24 224.0.0.0/4 240.0.0.0/4; do
    iptables -A OUTPUT -d "$network" -j REJECT
done
iptables -A OUTPUT -p tcp -j ACCEPT
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
ip6tables -P OUTPUT DROP
ip6tables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
# IPv6 public unicast only. Exclude special-use/tunnel ranges and local destinations.
for network in ::/96 ::ffff:0:0/96 64:ff9b::/96 64:ff9b:1::/48 100::/64 2001::/23 2001:db8::/32 2002::/16 3fff::/20 fc00::/7 fe80::/10 ff00::/8; do
    ip6tables -A OUTPUT -d "$network" -j REJECT
done
ip6tables -A OUTPUT -d 2000::/3 -p tcp -j ACCEPT
exec setpriv --reuid=10001 --regid=10001 --init-groups --bounding-set=-all \
    --inh-caps=-all --ambient-caps=-all --no-new-privs \
    python -m uvicorn camera_worker.main:app --host 0.0.0.0 --port 8001 --no-access-log
