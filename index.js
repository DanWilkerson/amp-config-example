'use strict'
const express = require('express')
const cookieParser = require('cookie-parser')
const request = require('request')
const app = express()
const port = 3000

app.use(cookieParser())

// GTM passthrough example
app.get('/gtm-analytics.config.json', (req, res) => {

  const domain = req.headers.host.split(':')[0]
  const gaCookie = req.cookies._ga || generateGaCookie(domain)
  const clientId = parseClientIdFromGaCookie(gaCookie)
  const cookieString = generateCookieString({
    name: '_ga',
    value: gaCookie,
    domain: domain.replace('www.', ''),
    path: '/',
    expires: new Date(1000 * 60 * 60 * 24 * 365 * 2 + (+new Date)).toGMTString()
  })
  const stockCidRegex = /CLIENT_ID\([^)]*\)/g

  res.setHeader('Set-Cookie', cookieString)
  // You may wish to set this dynamically - only one is allowed and it cannot
  // be a wildcard '*' when using Allow-Credentials
  res.setHeader('Access-Control-Allow-Origin', 'https://cdn.ampproject.org')
  res.setHeader('Access-Control-Expose-Headers', 'AMP-Access-Control-Allow-Source-Origin')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  // AMP-specific header, check your protocol
  res.setHeader('AMP-Access-Control-Allow-Source-Origin', 'https://' + domain)

  /**
   * This approach takes advantage of Google Tag Manager AMP Containers
   * https://analytics.googleblog.com/2016/10/google-tag-manager-giving-mobile.html
   * GTM returns properly formatted JSON for tags added in the interface, and
   * we extend the JSON with our Client ID here. Using GTM with AMP is recommended
   */
  request.get({
    url: 'https://www.googletagmanager.com/amp.json',
    qs: req.query,
    json: true
  }, (err, response, data) => {

    if (err) data = {"vars": {}}  // Add additional error handling here

    /**
     * On a side note, we're only adding the client ID value here, but
     * you could add other dynamic data, too, such as a User ID.
     * Just be aware that you generally have to manually insert the new data into
     * the 'responses' properties returned by GTM, which can be a bit of a pain.
     */
    data.vars.clientId = clientId

    data.requests = Object.keys(data.requests)
      .reduce((map, key) => {

        map[key] = data.requests[key].replace(stockCidRegex, '${clientId}')
        return map

      }, {})

    res.json(data)

  })

})

// Non-GTM example
app.get('/analytics.config.json', (req, res) => {

  const domain = req.headers.host.split(':')[0]
  const gaCookie = req.cookies._ga || generateGaCookie(domain)
  const clientId = parseClientIdFromGaCookie(gaCookie)
  const cookieString = generateCookieString({
    name: '_ga',
    value: gaCookie,
    domain: domain.replace('www.', ''),
    path: '/',
    expires: new Date(1000 * 60 * 60 * 24 * 365 * 2 + (+new Date)).toGMTString()
  })

  res.setHeader('Set-Cookie', cookieString)
  // You may wish to set this dynamically - only one is allowed and it cannot
  // be a wildcard '*' when using Allow-Credentials
  res.setHeader('Access-Control-Allow-Origin', 'https://cdn.ampproject.org')
  res.setHeader('Access-Control-Expose-Headers', 'AMP-Access-Control-Allow-Source-Origin')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  // AMP-specific header
  res.setHeader('AMP-Access-Control-Allow-Source-Origin', 'http://' + domain)

  /**
   * This counts on extending the default Google Analytics component
   * (<amp-analytics type="googleanalytics"></amp-analytics>)
   * If you'd like to roll your own configuration instead of using the
   * prepared defaults, do this here as well. For more, see:
   * https://www.ampproject.org/docs/reference/components/amp-analytics#configuration
   *
   * You can set additional variables here, too - see the note in the GTM example
   * above for some ideas.
   */
  res.json({
    "vars": {
      "clientId": clientId
    }
  })

})

app.listen(port, (err) => {

  if (err) return console.log(err)

  console.log('Listening on port ' + port)

})

function parseClientIdFromGaCookie(gaCookie) {

  return gaCookie.split('.').slice(-2).join('.')

}

function generateGaCookie(host) {

  return [
    'GA1',
     host.replace('www.', '').split('.').length,
     generateGaClientId()
  ].join('.')

}

function generateGaClientId() {

  const rand = Math.round(Math.random() * 2147483647)
  const ts = Math.round(+new Date() / 1000.0)

  return [rand, ts].join('.')

}

function generateCookieString(config) {

  let base = [[config.name, config.value]];

  ['domain', 'path', 'expires'].forEach(opt => {

    if (isDefined_(config[opt])) base.push([opt, config[opt]])

  })

  return base.map(pair => pair.join('=') + ';').join('')

}

function isDefined_(thing) {

  return typeof thing !== 'undefined'

}
