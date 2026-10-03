import { readFileSync } from "node:fs";
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const map = read("docs/project-map/app-map.json");
const roadmap = read("docs/project-map/roadmap.json");
const dependency = read("docs/project-map/dependencies.json");
const registry = read("packages/contracts/routes.json");
const feature = read("docs/project-map/feature-registry.json");
const modules = new Set(map.modules.map((x) => x.id));
const screens = new Map(map.screens.map((x) => [x.id, x]));
const workflows = new Set(map.workflows.map((x) => x.id));
const entities = new Set(map.entities.map((x) => x.id));
const roles = new Set(map.roles.map((x) => x.id));
const components = new Set(map.components.map((x) => x.id));
const actions = new Set(map.actions.map((x) => x.id));
const domains = new Set(map.domains.map((x) => x.id));
function refs(values, known, label) {
  for (const id of values ?? [])
    if (!known.has(id)) throw Error(`Invalid ${label}: ${id}`);
}
const ids = new Set();
for (const group of [
  map.domains,
  map.modules,
  map.screens,
  map.components,
  map.actions,
  map.workflows,
  map.entities,
  map.roles,
  map.features,
]) {
  for (const item of group) {
    if (ids.has(item.id)) throw Error(`Duplicate map ID: ${item.id}`);
    ids.add(item.id);
  }
}
if (
  screens.size !== feature.screens.length ||
  screens.size !== registry.routes.length
)
  throw Error("Screen count parity failed");
if (
  new Set(registry.routes.map((x) => x.screenId)).size !==
  registry.routes.length
)
  throw Error("Duplicate route screen ID");
for (const route of registry.routes) {
  const source = screens.get(route.screenId);
  if (
    !source ||
    source.moduleId !== route.moduleId ||
    !modules.has(route.moduleId)
  )
    throw Error(`Invalid route mapping ${route.screenId}`);
  if (
    route.routePattern !==
    (source.route.startsWith("/") ? source.route.split(" (")[0] : null)
  )
    throw Error(`Stale route mapping ${route.screenId}`);
  if (
    route.implementationStatus !== "NOT_IMPLEMENTED" &&
    !(
      ["SCR-026", "SCR-083"].includes(route.screenId) &&
      route.implementationStatus === "IMPLEMENTED"
    )
  )
    throw Error(`Unexpected implementation state ${route.screenId}`);
}
for (const screen of map.screens) {
  if (!modules.has(screen.moduleId))
    throw Error(`Unknown module ${screen.moduleId}`);
  if (!domains.has(screen.domainId))
    throw Error(`Unknown domain ${screen.domainId}`);
  if (screen.parentScreenId && !screens.has(screen.parentScreenId))
    throw Error(`Unknown parent ${screen.id}`);
  refs(screen.childScreenIds, screens, `child of ${screen.id}`);
  refs(screen.components, components, `components of ${screen.id}`);
  refs(screen.actions, actions, `actions of ${screen.id}`);
  refs(screen.workflowIds, workflows, `workflows of ${screen.id}`);
  refs(screen.entityIds, entities, `entities of ${screen.id}`);
}
for (const module of map.modules) {
  if (!domains.has(module.domainId))
    throw Error(`Unknown module domain ${module.id}`);
  refs(module.screens, screens, `screens of ${module.id}`);
  refs(module.workflows, workflows, `workflows of ${module.id}`);
  refs(module.entities, entities, `entities of ${module.id}`);
  refs(module.roles, roles, `roles of ${module.id}`);
}
for (const workflow of map.workflows) {
  refs(workflow.screenIds, screens, `screens of ${workflow.id}`);
  refs(workflow.moduleIds, modules, `modules of ${workflow.id}`);
  refs(workflow.entityIds, entities, `entities of ${workflow.id}`);
}
for (const featureItem of map.features) {
  if (!modules.has(featureItem.moduleId))
    throw Error(`Unknown feature module ${featureItem.id}`);
  refs(featureItem.screens, screens, `screens of ${featureItem.id}`);
  refs(featureItem.entities, entities, `entities of ${featureItem.id}`);
  refs(featureItem.workflows, workflows, `workflows of ${featureItem.id}`);
  refs(featureItem.roles, roles, `roles of ${featureItem.id}`);
}
for (const item of [...map.actions, ...map.components])
  if (!screens.has(item.screenId)) throw Error(`Invalid owner ${item.id}`);
if (new Set(feature.screens.map((x) => x.id)).size !== screens.size)
  throw Error("Discovery screen ID parity failed");
for (const screen of feature.screens)
  if (screens.get(screen.id)?.route !== screen.route)
    throw Error(`Discovery route parity ${screen.id}`);
const tasks = new Map(roadmap.tasks.map((x) => [x.id, x]));
if (tasks.size !== roadmap.tasks.length)
  throw Error("Duplicate roadmap task ID");
for (const task of roadmap.tasks)
  for (const prerequisite of task.dependencies)
    if (!tasks.has(prerequisite))
      throw Error(`Missing dependency ${prerequisite}`);
const nodes = new Set(dependency.nodes.map((x) => x.id));
const edges = new Map([...nodes].map((id) => [id, []]));
for (const edge of dependency.edges)
  if (!nodes.has(edge.from) || !nodes.has(edge.to))
    throw Error(`Invalid dependency edge ${edge.from} → ${edge.to}`);
  else if (edge.type === "MUST_PRECEDE") edges.get(edge.from).push(edge.to);
const visited = new Set();
const visiting = new Set();
function visit(id) {
  if (visiting.has(id)) throw Error(`Dependency cycle at ${id}`);
  if (visited.has(id)) return;
  visiting.add(id);
  for (const next of edges.get(id)) visit(next);
  visiting.delete(id);
  visited.add(id);
}
for (const id of nodes) visit(id);
console.log(
  `Project map PASS: ${screens.size} screens, ${modules.size} modules, ${tasks.size} roadmap tasks`,
);
