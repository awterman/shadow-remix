import fluent, { FluentIterable } from "fluent-iterable";
import {
  parse as html5parse,
  SyntaxKind,
  INode,
  WalkOptions,
  ITag,
} from "html5parser";

function* rawIter(ast: INode[]): IterableIterator<INode> {
  const stack: INode[] = [...ast];
  while (stack.length > 0) {
    const node = stack.pop()!;
    yield node;
    if (node.type == SyntaxKind.Tag && Array.isArray(node.body)) {
      stack.push(...node.body);
    }
  }
}

export function iter(ast: INode[]): FluentIterable<INode> {
  return fluent(rawIter(ast));
}

export function parse(html: string): FluentIterable<INode> {
  const ast = html5parse(html, { setAttributeMap: true });
  return iter(ast);
}
