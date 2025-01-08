import express from 'express'
import { z } from 'zod'
import { processRequest } from '../zod-middleware'
import { createGoals, updateGoal } from '../../lib/prisma'
import { wikidataIdParamSchema, GoalSchema } from '../../openapi/schemas'
import { Prisma } from '@prisma/client'
import { GarboAPIError } from '../../lib/garbo-api-error'
import { checkOrgMembership, authenticateJWT } from '../../lib/auth'

const router = express.Router()

// Apply authentication middleware to all routes
router.use(authenticateJWT)

/**
 * @swagger
 * /companies/{wikidataId}/goals:
 *   post:
 *     summary: Create company goals
 *     description: Create new goals for a specific company
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: wikidataId
 *         required: true
 *         schema:
 *           type: string
 *         description: Wikidata ID of the company
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               goals:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Goal'
 *     responses:
 *       200:
 *         description: Goals created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       404:
 *         description: Company not found
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/:wikidataId/goals',
  checkOrgMembership,
  processRequest({
    body: z.object({
      goals: z.array(GoalSchema),
    }),
    params: wikidataIdParamSchema,
  }),
  async (req, res) => {
    const { goals } = req.body

    if (goals?.length) {
      const { wikidataId } = req.params
      const metadata = res.locals.metadata

      await createGoals(wikidataId, goals, metadata!)
    }
    res.json({ ok: true })
  }
)

/**
 * @swagger
 * /companies/{wikidataId}/goals/{id}:
 *   patch:
 *     summary: Update a company goal
 *     description: Update an existing goal for a specific company
 *     tags: [Companies]
 *     parameters:
 *       - in: path
 *         name: wikidataId
 *         required: true
 *         schema:
 *           type: string
 *         description: Wikidata ID of the company
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Goal ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               goal:
 *                 $ref: '#/components/schemas/Goal'
 *     responses:
 *       200:
 *         description: Goal updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *       404:
 *         description: Goal not found
 *       422:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch(
  '/:wikidataId/goals/:id',
  checkOrgMembership,
  processRequest({
    body: z.object({ goal: GoalSchema }),
    params: z.object({ id: z.coerce.number() }),
  }),
  async (req, res) => {
    const { goal } = req.body
    const { id } = req.params
    const metadata = res.locals.metadata
    await updateGoal(id, goal, metadata!).catch((error) => {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new GarboAPIError('Goal not found', {
          statusCode: 404,
          original: error,
        })
      }
      throw error
    })
    res.json({ ok: true })
  }
)

export default router
