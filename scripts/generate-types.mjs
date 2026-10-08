import { compile } from "json-schema-to-typescript";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { URL } from "node:url";
const folder = new URL("../packages/contracts/json-schema/v1/", import.meta.url);
const definitions = {};
const roots = [];
for (const name of (await readdir(folder)).sort()) {
  const schema = JSON.parse(await readFile(new URL(name, folder), "utf8"));
  for (const [symbol, definition] of Object.entries(schema.$defs || {})) {
    if (definitions[symbol] && JSON.stringify(definitions[symbol]) !== JSON.stringify(definition)) throw new Error(`Conflicting contract: ${symbol}`);
    definitions[symbol] = definition;
  }
  const { $defs, $id, $schema, ...definition } = schema;
  void $defs; void $id; void $schema;
  definitions[schema.title] = definition;
  roots.push({ $ref: `#/$defs/${schema.title}` });
}
const output = await compile({ title: "Contracts", anyOf: roots, $defs: definitions }, "Contracts", {
  bannerComment: "// GENERATED from authoritative Python contracts via JSON Schema. Do not edit.",
});
const target = new URL("../packages/typescript-common/src/contracts.d.ts", import.meta.url);
if (process.argv.includes("--check")) {
  if (await readFile(target, "utf8") !== output) throw new Error("TypeScript contract drift");
} else await writeFile(target, output);
