import { BadRequestException, Injectable } from "@nestjs/common";
import { embed } from "./llm";
import { searchQuerySchema } from "./schemas";
import { ftsSearch, vectorSearch } from "./search.repo";

@Injectable()
export class SearchService {
  async search(input: unknown) {
    const parsed = searchQuerySchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("q 必填");
    const { q, mode, limit } = parsed.data;
    if (mode === "vector") {
      const [vec] = await embed([q]);
      return vectorSearch(vec, limit);
    }
    return ftsSearch(q, limit);
  }
}
