import type { IssueGateway } from "@/entities/issue";
import { demoHouse, formatLocation, validLocation, type House } from "@/entities/house";
import { issueCategories } from "@/entities/issue";

// No network calls. Replace through IssueProvider.gateway when an API is available.
export const createMockIssueGateway = (house: House): IssueGateway => ({
  async create(input, requestId) {
    if (!validLocation(house, input.place) || !issueCategories.some(category => category === input.category) || !input.title.trim() || !input.description.trim() || input.title.length > 120 || input.description.length > 2000) throw new Error("Проверьте место, категорию и описание.");
    await new Promise(resolve => setTimeout(resolve, 250));
    const createdAt = new Date().toISOString();
    return { ...input, mine: true, title: input.title.trim(), description: input.description.trim(), id: "local-" + requestId, createdAt, address: house.address, location: formatLocation(input.place), status: "new", history: [{ status: "new", at: createdAt }] };
  },
});
export const mockIssueGateway = createMockIssueGateway(demoHouse);
