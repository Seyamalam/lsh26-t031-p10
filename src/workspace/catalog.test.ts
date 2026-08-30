import { IDBFactory } from "fake-indexeddb"
import { beforeEach, describe, expect, it } from "vitest"

import fixtureJson from "../../public/data/P10_import_example.json"
import { validateFixture } from "../data/fixture"
import { WorkspaceCatalog, createDatasetRecord } from "./catalog"

describe("IndexedDB dataset catalog", () => {
  let catalog: WorkspaceCatalog
  const raw = JSON.stringify(fixtureJson)

  beforeEach(() => {
    catalog = new WorkspaceCatalog({
      indexedDB: new IDBFactory(),
      databaseName: crypto.randomUUID(),
    })
  })

  it("saves, lists, renames, exports, replaces, and deletes a fixture", async () => {
    const input = await createDatasetRecord({
      name: "Home meter",
      sourceFilename: "home.json",
      rawJson: raw,
      fixture: validateFixture(fixtureJson),
    })
    const saved = await catalog.saveDataset(input)
    expect(saved.deduplicated).toBe(false)
    expect((await catalog.listDatasets())[0]).toMatchObject({
      id: input.id,
      name: "Home meter",
      caseCount: 1,
      sourceFilename: "home.json",
    })
    await catalog.renameDataset(input.id, "Main household")
    expect((await catalog.getDataset(input.id))?.name).toBe("Main household")
    expect(await catalog.exportOriginal(input.id)).toBe(raw)

    const replacementRaw = JSON.stringify({
      ...fixtureJson,
      format_note: "replacement",
    })
    const replacement = await createDatasetRecord({
      name: "ignored",
      sourceFilename: "replacement.json",
      rawJson: replacementRaw,
      fixture: validateFixture(JSON.parse(replacementRaw)),
    })
    await catalog.replaceDataset(input.id, replacement)
    expect(await catalog.exportOriginal(input.id)).toBe(replacementRaw)
    expect((await catalog.getDataset(input.id))?.name).toBe("Main household")

    await catalog.deleteDataset(input.id)
    expect(await catalog.listDatasets()).toEqual([])
  })

  it("deduplicates byte-identical JSON by SHA-256 fingerprint", async () => {
    const first = await createDatasetRecord({
      name: "First",
      sourceFilename: "first.json",
      rawJson: raw,
      fixture: validateFixture(fixtureJson),
    })
    const second = await createDatasetRecord({
      name: "Second",
      sourceFilename: "second.json",
      rawJson: raw,
      fixture: validateFixture(fixtureJson),
    })
    await catalog.saveDataset(first)
    await catalog.renameDataset(first.id, "User name")
    await catalog.setControlState(first.id, "IMPORT-EXAMPLE", "alerts", {
      budget: 777,
    })
    const result = await catalog.saveDataset(second)
    expect(result.deduplicated).toBe(true)
    expect(result.record.id).toBe(first.id)
    expect(await catalog.listDatasets()).toHaveLength(1)
    expect(result.record.name).toBe("User name")
    expect(
      await catalog.getControlState(first.id, "IMPORT-EXAMPLE", "alerts")
    ).toEqual({ budget: 777 })
  })

  it("clears every saved dataset and its namespaced controls", async () => {
    const record = await createDatasetRecord({
      name: "Clear me",
      sourceFilename: "clear.json",
      rawJson: raw,
      fixture: validateFixture(fixtureJson),
    })
    await catalog.saveDataset(record)
    await catalog.setControlState(record.id, "IMPORT-EXAMPLE", "simulator", {
      wattage: 900,
    })
    await catalog.clearAll()
    expect(await catalog.listDatasets()).toEqual([])
    expect(
      await catalog.getControlState(record.id, "IMPORT-EXAMPLE", "simulator")
    ).toBeUndefined()
  })

  it("namespaces controls and last case by dataset and case", async () => {
    const record = await createDatasetRecord({
      id: "dataset-a",
      name: "A",
      sourceFilename: "a.json",
      rawJson: raw,
      fixture: validateFixture(fixtureJson),
    })
    await catalog.saveDataset(record)
    await catalog.setControlState("dataset-a", "PUB-01", "alerts", {
      budget: 1000,
    })
    await catalog.setControlState("dataset-b", "PUB-01", "alerts", {
      budget: 9000,
    })
    await catalog.setLastOpenedCase("dataset-a", "PUB-02")

    expect(
      await catalog.getControlState("dataset-a", "PUB-01", "alerts")
    ).toEqual({ budget: 1000 })
    expect(
      await catalog.getControlState("dataset-b", "PUB-01", "alerts")
    ).toEqual({ budget: 9000 })
    expect((await catalog.getDataset("dataset-a"))?.lastOpenedCase).toBe(
      "PUB-02"
    )
    expect(await catalog.getLastOpenedCase("dataset-a")).toBe("PUB-02")
  })
})
