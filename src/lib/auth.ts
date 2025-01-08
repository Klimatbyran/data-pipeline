import passport from 'passport'
import { Strategy as GitHubStrategy } from 'passport-github2'
import jwt from 'jsonwebtoken'
import { prisma } from './prisma'
import authConfig from '../config/auth'
import { Request, Response, NextFunction } from 'express'
import { GarboAPIError } from './garbo-api-error'
import axios from 'axios'
import { User } from '@prisma/client'

passport.use(
  new GitHubStrategy(
    authConfig.github,
    async (accessToken, refreshToken, profile, done) => {
      try {
        const user = await prisma.user.upsert({
          where: { email: profile.emails![0].value },
          update: {
            name: profile.displayName,
            githubId: profile.id,
            githubToken: accessToken,
          },
          create: {
            email: profile.emails![0].value,
            name: profile.displayName,
            githubId: profile.id,
            githubToken: accessToken,
          },
        })
        return done(null, user)
      } catch (error) {
        return done(error)
      }
    }
  )
)

passport.serializeUser((user: any, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id: number, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } })
    done(null, user)
  } catch (error) {
    done(error)
  }
})

export const generateToken = (user: any) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      githubId: user.githubId,
      githubToken: user.githubToken,
    },
    authConfig.jwt.secret,
    {
      expiresIn: authConfig.jwt.expiresIn,
    }
  )
}

export const authenticateJWT = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    throw new GarboAPIError('No authorization header', { statusCode: 401 })
  }

  const token = authHeader.split(' ')[1]

  try {
    const user = jwt.verify(token, authConfig.jwt.secret)
    res.locals.user = user
    next()
  } catch (error) {
    throw new GarboAPIError('Invalid token', { statusCode: 401 })
  }
}

export const checkOrgMembership = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = res.locals.user as User

  if (!user) {
    throw new GarboAPIError('User not authenticated', { statusCode: 401 })
  }

  try {
    const response = await axios.get(
      `https://api.github.com/orgs/${authConfig.github.organization}/members/${user.githubId}`,
      {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${user.githubToken}`,
        },
      }
    )

    if (response.status === 204) {
      next()
    } else {
      throw new GarboAPIError(
        'User is not a member of the required organization',
        { statusCode: 403 }
      )
    }
  } catch (error) {
    if (error.response?.status === 404) {
      throw new GarboAPIError(
        'User is not a member of the required organization',
        { statusCode: 403 }
      )
    }
    throw new GarboAPIError('Failed to verify organization membership', {
      statusCode: 500,
      original: error,
    })
  }
}
