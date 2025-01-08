import express from 'express'
import passport from 'passport'
import { generateToken } from '../lib/auth'
import auth from '../config/auth'
import { authenticateJWT } from '../lib/auth'

const router = express.Router()

router.get('/github', (req, res) => {
  // Store the original URL to redirect back after authentication
  req.session['returnTo'] = req.query.returnTo || req.headers.referer || '/'

  // Redirect to GitHub OAuth
  const authURL =
    `https://github.com/login/oauth/authorize?` +
    `client_id=${auth.github.clientID}&` +
    `redirect_uri=${encodeURIComponent(auth.github.callbackURL)}&` +
    `scope=user:email%20read:org`

  res.redirect(authURL)
})

router.get(
  '/github/callback',
  passport.authenticate('github', {
    failureRedirect: '/login',
    session: true,
  }),
  (req, res) => {
    const token = generateToken(req.user)
    const returnTo = req.session['returnTo'] || '/'
    delete req.session['returnTo']

    // Redirect with token as query parameter
    res.redirect(`${returnTo}?token=${token}`)
  }
)

export default router
