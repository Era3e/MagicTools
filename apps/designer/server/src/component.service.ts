import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { deleteComponent, findComponentByName, getComponent, insertComponent, listComponents } from "./component.repo";
import { componentInputSchema } from "./schemas";

@Injectable()
export class ComponentService {
  async add(input: unknown) {
    const parsed = componentInputSchema.safeParse(input);
    if (!parsed.success) throw new BadRequestException("name 与 code 必填");
    const { name, description, code } = parsed.data;
    const inserted = await insertComponent(name, description, code);
    if (inserted) return { component: inserted, duplicated: false };
    return { component: await findComponentByName(name), duplicated: true };
  }

  list() {
    return listComponents();
  }

  async code(id: string) {
    const row = await getComponent(id);
    if (!row) throw new NotFoundException("组件不存在");
    return row;
  }

  async remove(id: string) {
    if (!(await deleteComponent(id))) throw new NotFoundException("组件不存在");
    return { deleted: true };
  }
}
