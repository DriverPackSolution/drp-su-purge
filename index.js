var http = require('http')
var createHandler = require('github-webhook-handler')
var request = require('superagent')

require('console-stamp')(console)

var GITHUB_SECRET = process.env.GITHUB_SECRET;
var CLOUDFLARE_ZONE = process.env.CLOUDFLARE_ZONE;
var CLOUDFLARE_EMAIL = process.env.CLOUDFLARE_EMAIL;
var CLOUDFLARE_KEY = process.env.CLOUDFLARE_KEY;

var handler = createHandler({path: '/deploy', secret: GITHUB_SECRET})

var port = process.env.PORT || 3000

http.createServer(function (req, res) {
  handler(req, res, function (err) {
    res.statusCode = 404
    res.end('no such location')
  })
}).listen(port)

handler.on('error', function (err) {
  console.error('Error:', err.message)
})

handler.on('push', function (event) {
  // 60 second delay as a workaround for race condition with git pull
  setTimeout(function () {
    console.log('Received a push event for %s to %s',
      event.payload.repository.name,
      event.payload.ref)
    if (event.payload.ref !== 'refs/heads/master') {
      return
    }
    console.log('master was deployed, purging cache...')
    request.del('https://api.cloudflare.com/client/v4/zones/' + CLOUDFLARE_ZONE + '/purge_cache')
      .set('X-Auth-Email', CLOUDFLARE_EMAIL)
      .set('X-Auth-Key', CLOUDFLARE_KEY)
      .set('Content-Type', 'application/json')
      .send({purge_everything: true})
      .end(function (err, res) {
        if (err) {
          console.log('cloudflare: failed to reset cache', err)
        } else {
          console.log('cloudflare: reset cache', res.body)
        }
      })
  }, 60000)
})
