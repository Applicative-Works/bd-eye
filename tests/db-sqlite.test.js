import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { rmSync } from 'node:fs'
import { createTestDb, seedIssues } from './helpers.js'
import { openSqliteDb } from '../src/server/db-sqlite.js'

describe('openSqliteDb', () => {
  let db
  let rawDb
  let dbPath
  let dir

  beforeAll(async () => {
    ;({ db: rawDb, dbPath, dir } = createTestDb())
    seedIssues(rawDb)
    rawDb.close()
    db = await openSqliteDb(dbPath)
  })

  afterAll(async () => {
    await db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  describe('allIssues', () => {
    it('returns all non-deleted non-tombstone issues', async () => {
      const issues = await db.allIssues()
      const ids = issues.map((i) => i.id)
      expect(ids).not.toContain('deleted-1')
      expect(ids).toEqual(expect.arrayContaining(['issue-1', 'issue-2', 'issue-3', 'issue-4', 'issue-5']))
      expect(issues).toHaveLength(5)
    })

    it('sorts by priority then created_at', async () => {
      const issues = await db.allIssues()
      const priorities = issues.map((i) => i.priority)
      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1])
      }
    })
  })

  describe('issueById', () => {
    it('returns the matching issue', async () => {
      const issue = await db.issueById('issue-1')
      expect(issue).toMatchObject({ id: 'issue-1', title: 'First issue' })
    })

    it.each([
      ['non-existent id', 'no-such-id'],
      ['deleted issue', 'deleted-1'],
    ])('returns undefined for %s', async (_label, id) => {
      expect(await db.issueById(id)).toBeUndefined()
    })
  })

  describe('readyIssues', () => {
    it('excludes blocked issues', async () => {
      const ready = await db.readyIssues()
      const ids = ready.map((i) => i.id)
      expect(ids).not.toContain('issue-5')
    })

    it('excludes deleted issues', async () => {
      const ready = await db.readyIssues()
      const ids = ready.map((i) => i.id)
      expect(ids).not.toContain('deleted-1')
    })

    it('includes non-blocked alive issues', async () => {
      const ready = await db.readyIssues()
      const ids = ready.map((i) => i.id)
      expect(ids).toContain('issue-1')
      expect(ids).toContain('issue-2')
    })
  })

  describe('blockedIssues', () => {
    it('returns issues with open blocking dependencies', async () => {
      const blocked = await db.blockedIssues()
      const ids = blocked.map((i) => i.id)
      expect(ids).toContain('issue-5')
    })

    it('includes blocked_by_count', async () => {
      const blocked = await db.blockedIssues()
      const issue5 = blocked.find((i) => i.id === 'issue-5')
      expect(issue5.blocked_by_count).toBe(1)
    })

    it('excludes deleted issues', async () => {
      const blocked = await db.blockedIssues()
      const ids = blocked.map((i) => i.id)
      expect(ids).not.toContain('deleted-1')
    })
  })

  describe('dependenciesFor', () => {
    it('returns blockedBy for a blocked issue', async () => {
      const deps = await db.dependenciesFor('issue-5')
      expect(deps.blockedBy.map((i) => i.id)).toEqual(['issue-1'])
    })

    it('returns blocks for a blocking issue', async () => {
      const deps = await db.dependenciesFor('issue-1')
      expect(deps.blocks.map((i) => i.id)).toEqual(['issue-5'])
    })

    it('returns empty arrays for an issue with no dependencies', async () => {
      const deps = await db.dependenciesFor('issue-2')
      expect(deps.blockedBy).toEqual([])
      expect(deps.blocks).toEqual([])
    })
  })

  describe('epics', () => {
    it('returns only epic issues', async () => {
      const epics = await db.epics()
      expect(epics).toHaveLength(1)
      expect(epics[0]).toMatchObject({ id: 'issue-4', issue_type: 'epic' })
    })
  })

  describe('epicChildren', () => {
    it('returns children linked via parent-child dependency', async () => {
      const children = await db.epicChildren('issue-4')
      expect(children.map((i) => i.id)).toEqual(['issue-2'])
    })

    it('returns empty array for epic with no children', async () => {
      const children = await db.epicChildren('issue-1')
      expect(children).toEqual([])
    })
  })

  describe('labels', () => {
    it('returns distinct label strings sorted alphabetically', async () => {
      const labels = await db.labels()
      expect(labels).toEqual(['backend', 'frontend', 'urgent'])
    })
  })

  describe('allLabels', () => {
    it('returns all issue_id/label pairs', async () => {
      const allLabels = await db.allLabels()
      expect(allLabels).toHaveLength(3)
      expect(allLabels).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ issue_id: 'issue-1', label: 'backend' }),
          expect.objectContaining({ issue_id: 'issue-1', label: 'urgent' }),
          expect.objectContaining({ issue_id: 'issue-2', label: 'frontend' }),
        ])
      )
    })
  })

  describe('commentsFor', () => {
    it('returns comments for an issue ordered by created_at', async () => {
      const comments = await db.commentsFor('issue-1')
      expect(comments).toHaveLength(2)
      expect(comments[0]).toMatchObject({ author: 'alice', text: 'Looks good' })
      expect(comments[1]).toMatchObject({ author: 'bob', text: 'Agreed' })
    })

    it('returns empty array for issue with no comments', async () => {
      const comments = await db.commentsFor('issue-2')
      expect(comments).toEqual([])
    })
  })

  describe('searchIssues', () => {
    it.each([
      ['title', 'First', ['issue-1']],
      ['description', 'Description two', ['issue-2']],
      ['notes', 'Some notes', ['issue-1']],
    ])('matches against %s', async (_field, query, expectedIds) => {
      const results = await db.searchIssues(query)
      expect(results.map((i) => i.id)).toEqual(expectedIds)
    })

    it('excludes deleted issues from results', async () => {
      const results = await db.searchIssues('Gone')
      expect(results).toEqual([])
    })

    it('returns empty array for no matches', async () => {
      const results = await db.searchIssues('zzzznonexistent')
      expect(results).toEqual([])
    })
  })

  describe('close', () => {
    it('closes without error', async () => {
      const { db: rawDb2, dbPath: path2, dir: dir2 } = createTestDb()
      rawDb2.close()
      const db2 = await openSqliteDb(path2)
      await expect(db2.close()).resolves.not.toThrow()
      rmSync(dir2, { recursive: true, force: true })
    })
  })
})
