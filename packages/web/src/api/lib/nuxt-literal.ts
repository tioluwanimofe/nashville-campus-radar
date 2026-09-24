/**
 * Safe, dependency-free evaluator for the `window.__NUXT__ = (function(a,b,...){return
 * {...}}(litA, litB, ...))` payload that Nuxt SSR pages (e.g. Coursedog's embedded
 * calendar) ship instead of plain JSON.
 *
 * This is NOT eval() and never calls Function()/vm. It hand-parses one narrow grammar —
 * an IIFE whose body is exactly `return <literal-expression>` and whose call arguments are
 * themselves literal expressions — and rejects (throws) anything outside that grammar:
 * no member access, no other function calls, no operators besides unary `-`/`void`. A
 * hostile or malformed payload can only fail to parse; it can never execute code.
 */

type Token =
  | { type: "punct"; value: string }
  | { type: "string"; value: string }
  | { type: "number"; value: number }
  | { type: "ident"; value: string }
  | { type: "eof" };

const PUNCT = new Set(["(", ")", "{", "}", "[", "]", ",", ":", ";"]);

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i]!;
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      i++;
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let out = "";
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === "\\") {
          const esc = src[i + 1];
          if (esc === "n") out += "\n";
          else if (esc === "t") out += "\t";
          else if (esc === "r") out += "\r";
          else if (esc === "b") out += "\b";
          else if (esc === "f") out += "\f";
          else if (esc === "v") out += "\v";
          else if (esc === "0") out += "\0";
          else if (esc === "u") {
            if (src[i + 2] === "{") {
              const end = src.indexOf("}", i + 3);
              out += String.fromCodePoint(parseInt(src.slice(i + 3, end), 16));
              i = end + 1 - 2; // compensate for the +=2 below
            } else {
              out += String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16));
              i += 4;
            }
          } else if (esc === "x") {
            out += String.fromCharCode(parseInt(src.slice(i + 2, i + 4), 16));
            i += 2;
          } else if (esc === "\n") {
            // line continuation — emit nothing
          } else {
            out += esc;
          }
          i += 2;
        } else {
          out += src[i];
          i++;
        }
      }
      i++; // closing quote
      tokens.push({ type: "string", value: out });
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i;
      while (j < n && /[0-9.eE+-]/.test(src[j]!)) {
        if ((src[j] === "+" || src[j] === "-") && !/[eE]/.test(src[j - 1] ?? "")) break;
        j++;
      }
      tokens.push({ type: "number", value: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j]!)) j++;
      tokens.push({ type: "ident", value: src.slice(i, j) });
      i = j;
      continue;
    }
    if (PUNCT.has(ch)) {
      tokens.push({ type: "punct", value: ch });
      i++;
      continue;
    }
    if (ch === "-" || ch === "+") {
      tokens.push({ type: "punct", value: ch });
      i++;
      continue;
    }
    throw new Error(`nuxt-literal: unexpected character ${JSON.stringify(ch)} at ${i}`);
  }
  tokens.push({ type: "eof" });
  return tokens;
}

/** AST node types this grammar recognises. Anything else throws during parsing. */
type Node =
  | { t: "str"; v: string }
  | { t: "num"; v: number }
  | { t: "bool"; v: boolean }
  | { t: "null" }
  | { t: "undef" }
  | { t: "ident"; v: string }
  | { t: "array"; items: (Node | null)[] }
  | { t: "object"; props: Array<{ key: string; value: Node }> }
  | { t: "unary"; op: "-" | "+" | "void"; arg: Node };

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek() {
    return this.tokens[this.pos]!;
  }
  private next() {
    return this.tokens[this.pos++]!;
  }
  /** True when the current token is punctuation equal to `v`. Narrows via one `peek()` call. */
  private isPunct(v: string): boolean {
    const t = this.peek();
    return t.type === "punct" && t.value === v;
  }
  private expectPunct(v: string) {
    const t = this.next();
    if (t.type !== "punct" || t.value !== v) {
      throw new Error(`nuxt-literal: expected "${v}" at token ${this.pos - 1}, got ${JSON.stringify(t)}`);
    }
  }
  private expectIdent(v: string) {
    const t = this.next();
    if (t.type !== "ident" || t.value !== v) {
      throw new Error(`nuxt-literal: expected keyword "${v}" at token ${this.pos - 1}, got ${JSON.stringify(t)}`);
    }
  }

  /** Entry point: `(function(params){return expr;}(args))` optionally trailed by `;`. */
  parseProgram(): { params: string[]; body: Node; args: Node[] } {
    this.expectPunct("(");
    this.expectIdent("function");
    this.expectPunct("(");
    const params: string[] = [];
    if (!(this.isPunct(")"))) {
      for (;;) {
        const t = this.next();
        if (t.type !== "ident") throw new Error("nuxt-literal: expected parameter name");
        params.push(t.value);
        if (this.isPunct(",")) {
          this.next();
          continue;
        }
        break;
      }
    }
    this.expectPunct(")");
    this.expectPunct("{");
    this.expectIdent("return");
    const body = this.parseExpr();
    if (this.isPunct(";")) this.next();
    this.expectPunct("}");
    this.expectPunct("(");
    const args: Node[] = [];
    if (!(this.isPunct(")"))) {
      for (;;) {
        args.push(this.parseExpr());
        if (this.isPunct(",")) {
          this.next();
          continue;
        }
        break;
      }
    }
    this.expectPunct(")");
    this.expectPunct(")");
    if (this.isPunct(";")) this.next();
    if (this.peek().type !== "eof") throw new Error("nuxt-literal: unexpected trailing content");
    return { params, body, args };
  }

  private parseExpr(): Node {
    const t = this.peek();
    if (t.type === "punct" && (t.value === "-" || t.value === "+")) {
      this.next();
      return { t: "unary", op: t.value as "-" | "+", arg: this.parseExpr() };
    }
    if (t.type === "ident" && t.value === "void") {
      this.next();
      this.parseExpr(); // operand is discarded — void always yields undefined
      return { t: "undef" };
    }
    if (t.type === "string") {
      this.next();
      return { t: "str", v: t.value };
    }
    if (t.type === "number") {
      this.next();
      return { t: "num", v: t.value };
    }
    if (t.type === "ident") {
      this.next();
      if (t.value === "true") return { t: "bool", v: true };
      if (t.value === "false") return { t: "bool", v: false };
      if (t.value === "null") return { t: "null" };
      if (t.value === "undefined") return { t: "undef" };
      return { t: "ident", v: t.value };
    }
    if (t.type === "punct" && t.value === "[") {
      this.next();
      const items: (Node | null)[] = [];
      while (!(this.isPunct("]"))) {
        if (this.isPunct(",")) {
          items.push(null); // elision
          this.next();
          continue;
        }
        items.push(this.parseExpr());
        if (this.isPunct(",")) this.next();
        else break;
      }
      this.expectPunct("]");
      return { t: "array", items };
    }
    if (t.type === "punct" && t.value === "{") {
      this.next();
      const props: Array<{ key: string; value: Node }> = [];
      while (!(this.isPunct("}"))) {
        const k = this.next();
        let key: string;
        if (k.type === "string") key = k.value;
        else if (k.type === "number") key = String(k.value);
        else if (k.type === "ident") key = k.value;
        else throw new Error("nuxt-literal: expected object key");
        this.expectPunct(":");
        const value = this.parseExpr();
        props.push({ key, value });
        if (this.isPunct(",")) this.next();
        else break;
      }
      this.expectPunct("}");
      return { t: "object", props };
    }
    throw new Error(`nuxt-literal: unsupported expression at token ${this.pos}: ${JSON.stringify(t)}`);
  }
}

function evaluate(node: Node, scope: Record<string, unknown>): unknown {
  switch (node.t) {
    case "str":
      return node.v;
    case "num":
      return node.v;
    case "bool":
      return node.v;
    case "null":
      return null;
    case "undef":
      return undefined;
    case "ident":
      if (Object.prototype.hasOwnProperty.call(scope, node.v)) return scope[node.v];
      throw new Error(`nuxt-literal: unresolved identifier "${node.v}"`);
    case "unary": {
      const v = evaluate(node.arg, scope);
      if (node.op === "void") return undefined;
      if (typeof v !== "number") throw new Error("nuxt-literal: unary +/- on a non-number");
      return node.op === "-" ? -v : v;
    }
    case "array":
      return node.items.map((it) => (it ? evaluate(it, scope) : undefined));
    case "object": {
      const out: Record<string, unknown> = {};
      for (const p of node.props) out[p.key] = evaluate(p.value, scope);
      return out;
    }
  }
}

/**
 * Parse and safely evaluate a `(function(...){return ...}(...))` literal payload.
 * Throws on anything that isn't pure data — never executes arbitrary code.
 */
export function evalNuxtLiteral(src: string): unknown {
  const program = new Parser(tokenize(src)).parseProgram();
  const argValues = program.args.map((a) => evaluate(a, {}));
  const scope: Record<string, unknown> = {};
  program.params.forEach((name, idx) => {
    scope[name] = argValues[idx];
  });
  return evaluate(program.body, scope);
}

/**
 * Pull the `window.__NUXT__ = (function...)` expression out of an SSR page and evaluate it.
 * Locates the enclosing <script> tag by plain string search (not a greedy regex) so that
 * parentheses inside quoted description text can never confuse where the expression ends —
 * the boundary is the script tag itself, not a pattern match against its contents.
 */
export function extractNuxtState(html: string): unknown {
  const nuxtIdx = html.indexOf("__NUXT__");
  if (nuxtIdx === -1) throw new Error("nuxt-literal: no __NUXT__ marker found in page");
  const scriptStart = html.lastIndexOf("<script", nuxtIdx);
  const scriptEnd = html.indexOf("</script>", nuxtIdx);
  if (scriptStart === -1 || scriptEnd === -1) {
    throw new Error("nuxt-literal: could not locate the enclosing <script> tag");
  }
  const openTagEnd = html.indexOf(">", scriptStart);
  const scriptBody = html.slice(openTagEnd + 1, scriptEnd);
  const eqIdx = scriptBody.indexOf("=", scriptBody.indexOf("__NUXT__"));
  if (eqIdx === -1) throw new Error("nuxt-literal: no assignment found after __NUXT__");
  let exprSrc = scriptBody.slice(eqIdx + 1).trim();
  if (exprSrc.endsWith(";")) exprSrc = exprSrc.slice(0, -1).trim();
  return evalNuxtLiteral(exprSrc);
}
