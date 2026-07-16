import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit'
import { prisma } from '@/lib/db'

jest.mock('@/lib/db', () => ({
  prisma: {
    rateLimit: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

const rateLimit = prisma.rateLimit as unknown as {
  findUnique: jest.Mock
  upsert: jest.Mock
  update: jest.Mock
  delete: jest.Mock
}

const future = () => new Date(Date.now() + 60_000)
const past = () => new Date(Date.now() - 60_000)

beforeEach(() => {
  jest.clearAllMocks()
  rateLimit.findUnique.mockResolvedValue(null)
  rateLimit.upsert.mockResolvedValue(undefined)
  rateLimit.update.mockResolvedValue(undefined)
  rateLimit.delete.mockResolvedValue(undefined)
})

describe('checkRateLimit', () => {
  it('allows and starts the window when no record exists', async () => {
    const result = await checkRateLimit('test-key')
    expect(result.allowed).toBe(true)
    expect(rateLimit.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'test-key' },
        create: expect.objectContaining({ key: 'test-key', count: 1 }),
        update: expect.objectContaining({ count: 1 }),
      })
    )
  })

  it('allows and restarts the window when the record expired', async () => {
    rateLimit.findUnique.mockResolvedValue({ key: 'test-key', count: 5, resetAt: past() })
    const result = await checkRateLimit('test-key')
    expect(result.allowed).toBe(true)
    expect(rateLimit.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ count: 1 }) })
    )
  })

  it('allows and increments while under the limit', async () => {
    rateLimit.findUnique.mockResolvedValue({ key: 'test-key', count: 4, resetAt: future() })
    const result = await checkRateLimit('test-key')
    expect(result.allowed).toBe(true)
    expect(rateLimit.update).toHaveBeenCalledWith({
      where: { key: 'test-key' },
      data: { count: { increment: 1 } },
    })
  })

  it('blocks the 6th attempt within the window', async () => {
    rateLimit.findUnique.mockResolvedValue({ key: 'test-key', count: 5, resetAt: future() })
    const result = await checkRateLimit('test-key')
    expect(result.allowed).toBe(false)
    expect(rateLimit.update).not.toHaveBeenCalled()
    expect(rateLimit.upsert).not.toHaveBeenCalled()
  })

  it('tracks different keys independently', async () => {
    rateLimit.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) =>
      where.key === 'key-a' ? { key: 'key-a', count: 5, resetAt: future() } : null
    )
    expect((await checkRateLimit('key-a')).allowed).toBe(false)
    expect((await checkRateLimit('key-b')).allowed).toBe(true)
  })
})

describe('resetRateLimit', () => {
  it('deletes the record for the key', async () => {
    await resetRateLimit('test-key')
    expect(rateLimit.delete).toHaveBeenCalledWith({ where: { key: 'test-key' } })
  })

  it('ignores a missing record', async () => {
    rateLimit.delete.mockRejectedValue(new Error('Record to delete does not exist'))
    await expect(resetRateLimit('missing-key')).resolves.toBeUndefined()
  })
})
