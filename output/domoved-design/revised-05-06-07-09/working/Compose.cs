using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public static class DomovedCompose
{
    static string root;
    static string dest;
    static Bitmap logo;
    static Bitmap icon;
    static Rectangle logoBounds;
    static Rectangle iconBounds;

    static Bitmap Load(string p) { return new Bitmap(p); }
    static Bitmap Original(string n) { return Load(Path.Combine(root, n)); }
    static Rectangle Bounds(Bitmap b)
    {
        int l=b.Width, t=b.Height, r=0, d=0;
        for(int y=0;y<b.Height;y++) for(int x=0;x<b.Width;x++)
            if(b.GetPixel(x,y).A>0) { l=Math.Min(l,x); t=Math.Min(t,y); r=Math.Max(r,x); d=Math.Max(d,y); }
        return Rectangle.FromLTRB(l,t,r+1,d+1);
    }
    static Bitmap Crop(Bitmap source, int width)
    {
        return source.Clone(new Rectangle(0,0,width,source.Height), PixelFormat.Format32bppArgb);
    }
    static void Copy(Bitmap to, Bitmap from, Rectangle rect)
    {
        using(var patch=from.Clone(rect,PixelFormat.Format32bppArgb))
        using(var g=Graphics.FromImage(to))
        { g.CompositingMode=CompositingMode.SourceCopy; g.DrawImageUnscaled(patch,rect.Location); }
    }
    static void ClearRows(Bitmap b, Rectangle area, int sampleLeft, int sampleRight)
    {
        for(int y=area.Top;y<area.Bottom;y++)
        {
            var left=b.GetPixel(sampleLeft,y); var right=b.GetPixel(sampleRight,y);
            for(int x=area.Left;x<area.Right;x++)
            {
                double f=(double)(x-sampleLeft)/(sampleRight-sampleLeft);
                b.SetPixel(x,y,Color.FromArgb(255,
                    (int)Math.Round(left.R+(right.R-left.R)*f),
                    (int)Math.Round(left.G+(right.G-left.G)*f),
                    (int)Math.Round(left.B+(right.B-left.B)*f)));
            }
        }
    }
    static void Insert(Bitmap b, Bitmap asset, Rectangle bounds, float x, float y, float width)
    {
        float height=width*bounds.Height/bounds.Width;
        using(var g=Graphics.FromImage(b))
        using(var attrs=new ImageAttributes())
        {
            attrs.SetWrapMode(WrapMode.TileFlipXY);
            g.CompositingMode=CompositingMode.SourceOver;
            g.InterpolationMode=InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode=PixelOffsetMode.HighQuality;
            g.DrawImage(asset,new RectangleF(x,y,width,height),bounds,GraphicsUnit.Pixel);
        }
    }
    static void Header(Bitmap b, int panelLeft, int panelRight, float center, float width, Bitmap original, Rectangle? back)
    {
        ClearRows(b,Rectangle.FromLTRB(panelLeft+12,54,panelRight-12,117),panelLeft+9,panelRight-9);
        if(back.HasValue) Copy(b,original,back.Value);
        float height=width*logoBounds.Height/logoBounds.Width;
        Insert(b,logo,logoBounds,center-width/2,82-height/2,width);
    }
    static void Save(Bitmap b,string n) { b.Save(Path.Combine(dest,n),ImageFormat.Png); }
    public static int Differences(Bitmap a,Bitmap b,Rectangle rect)
    {
        int count=0;
        for(int y=rect.Top;y<rect.Bottom;y++) for(int x=rect.Left;x<rect.Right;x++)
            if(a.GetPixel(x,y).ToArgb()!=b.GetPixel(x,y).ToArgb()) count++;
        return count;
    }
    public static string Run(string sourceRoot)
    {
        root=sourceRoot; dest=Path.Combine(root,"revised-05-06-07-09");
        logo=Load(Path.Combine(dest,"assets","exec-88adf04b-267c-47cd-9ae8-f2d9e705b537.png"));
        icon=Load(Path.Combine(dest,"assets","exec-763d35df-842b-4d76-a893-c440b24d7179.png"));
        logoBounds=Bounds(logo); iconBounds=Bounds(icon);
        using(var o=Original("05-cameras-light-detail-dark.png"))
        using(var b=(Bitmap)o.Clone())
        using(var edit=Load(Path.Combine(dest,"working","05-edited.png")))
        {
            if(edit.Size!=o.Size) throw new Exception("05 edit dimensions changed");
            Copy(b,edit,new Rectangle(523,639,404,280));
            Header(b,36,476,256,210,o,null);
            Header(b,506,944,725,168,o,new Rectangle(526,65,114,43));
            int differences=Differences(o,b,new Rectangle(960,0,488,o.Height));
            if(differences!=0) throw new Exception("Protected dark screen changed");
            Save(b,"05-cameras-light-detail-dark.png");
        }
        using(var o=Original("06-more-contacts-messages.png"))
        using(var b=Crop(o,974))
        {
            Header(b,33,470,251.5f,210,o,null);
            Header(b,509,941,725,210,o,new Rectangle(526,64,80,43));
            // Replace only the two old brand graphics; keep the original tagline.
            ClearRows(b,new Rectangle(61,875,79,70),55,143);
            ClearRows(b,new Rectangle(145,879,137,38),141,310);
            Insert(b,icon,iconBounds,65,878,69);
            Insert(b,logo,logoBounds,150,887,125);
            Save(b,"06-more-contacts-messages.png");
        }
        using(var o=Original("07-house-floor-information.png"))
        using(var b=(Bitmap)o.Clone())
        using(var edit=Load(Path.Combine(dest,"working","07-edited.png")))
        {
            if(edit.Size!=o.Size) throw new Exception("07 edit dimensions changed");
            Copy(b,edit,new Rectangle(44,256,411,276));
            Copy(b,edit,new Rectangle(518,420,416,533));
            Copy(b,edit,new Rectangle(989,329,414,642));
            Header(b,34,474,254,210,o,null);
            Header(b,506,944,725,210,o,null);
            Header(b,976,1415,1195.5f,210,o,null);
            Save(b,"07-house-floor-information.png");
        }
        using(var o=Original("09-health-onboarding-guide.png"))
        using(var b=Crop(o,507))
        {
            Header(b,33,474,253.5f,210,o,null);
            if(Differences(o,b,new Rectangle(0,117,507,o.Height-117))!=0)
                throw new Exception("09 body changed");
            Save(b,"09-health-onboarding-guide.png");
        }
        logo.Dispose(); icon.Dispose();
        return "Saved four PNGs; 05 protected right column: 0 changed pixels; 09 body: 0 changed pixels. Logos inserted directly from supplied PNGs, preserving aspect ratio.";
    }
}
