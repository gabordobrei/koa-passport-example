const Koa = require('koa')
const CSRF = require('koa-csrf').default
const app = new Koa()

// trust proxy
app.proxy = true

// MongoDB
const mongoose = require('mongoose')
console.log('connecting to MongoDB...')
mongoose.connect(process.env.MONGODB_URI || 'localhost')

// sessions
const convert = require('koa-convert')
const session = require('koa-generic-session')
const MongoStore = require('koa-generic-session-mongo')

app.keys = ['your-session-secret', 'another-session-secret']
app.use(convert(session({
  store: new MongoStore()
})))

// body parser
const bodyParser = require('koa-bodyparser')
app.use(bodyParser())

// csrf
app.use(new CSRF({
  invalidSessionSecretMessage: 'Invalid session secret',
  invalidSessionSecretStatusCode: 403,
  invalidTokenMessage: 'Invalid CSRF token',
  invalidTokenStatusCode: 403
}))

// authentication
require('./auth')
const passport = require('koa-passport')
app.use(passport.initialize())
app.use(passport.session())

// routes
const fs    = require('fs')
const route = require('koa-route')

app.use(route.get('/', function(ctx) {
  ctx.type = 'html'
  var body = fs.readFileSync('views/login.html', 'utf8')
  ctx.body = body.replace('{csrfToken}', ctx.csrf)
}))

app.use(route.post('/custom', function(ctx, next) {
  return passport.authenticate('local', function(user, info, status) {
    if (user === false) {
      ctx.status = 401
      ctx.body = { success: false }
    } else {
      ctx.body = { success: true }
      return ctx.login(user)
    }
  })(ctx, next)
}))

// POST /login
app.use(route.post('/login',
  passport.authenticate('local', {
    successRedirect: '/app',
    failureRedirect: '/'
  })
))

app.use(route.get('/logout', function(ctx) {
  ctx.logout()
  ctx.redirect('/')
}))

app.use(route.get('/auth/facebook',
  passport.authenticate('facebook')
))

app.use(route.get('/auth/facebook/callback',
  passport.authenticate('facebook', {
    successRedirect: '/app',
    failureRedirect: '/'
  })
))

app.use(route.get('/auth/twitter',
  passport.authenticate('twitter')
))

app.use(route.get('/auth/twitter/callback',
  passport.authenticate('twitter', {
    successRedirect: '/app',
    failureRedirect: '/'
  })
))

app.use(route.get('/auth/google',
  passport.authenticate('google')
))

app.use(route.get('/auth/google/callback',
  passport.authenticate('google', {
    successRedirect: '/app',
    failureRedirect: '/'
  })
))

// Require authentication for now
app.use(function(ctx, next) {
  if (ctx.isAuthenticated()) {
    return next()
  } else {
    ctx.redirect('/')
  }
})

app.use(route.get('/app', function(ctx) {
  ctx.type = 'html'
  ctx.body = fs.createReadStream('views/app.html')
}))

// start server
const port = process.env.PORT || 3000
app.listen(port, () => console.log('Server listening on', port))
