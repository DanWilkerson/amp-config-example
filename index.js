'use strict';
const express = require('express')
const cookieParser = require('cookie-parser')
const crypto = require('crypto')
const request = require('request')
const app = express()
const port = 3000;

app.use(cookieParser())

// GTM passthrough example
app.get('/gtm-analytics.config.json', (req, res) => {

  const containerId = 'GTM-PZM2M3'
  const domain = req.headers.host.split(':')[0]
  const gaCookie = req.cookies._ga || generateGaCookie(domain)
  const clientId = parseClientIdFromGaCookie(gaCookie)
  const cookieString = generateCookieString({
    name: '_ga',
    value: gaCookie,
    domain: domain,
    path: '/',
    expires: new Date(1000 * 60 * 60 * 24 * 365 * 2 + (+new Date)).toGMTString()
  })
  const stockCid = 'CLIENT_ID(AMP_ECID_GOOGLE)'

  res.set('Set-Cookie', cookieString)
  res.setHeader('Access-Control-Allow-Origin', 'https://cdn.ampproject.org')
  res.setHeader('Access-Control-Expose-Headers', 'AMP-Access-Control-Allow-Source-Origin')
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  // AMP-specific header
  res.setHeader('AMP-Access-Control-Allow-Source-Origin', 'https://' + domain)

  // For increased performance, cache this instead
  request.get({
    url: `https://www.googletagmanager.com/amp.json?id=${containerId}&clientId=${clientId}`,
    json: true
  }, (err, response, data) => {

    if (err) data = {"vars": {}}  // Add additional error handling here

    data.vars.clientId = clientId

    data.requests = Object.keys(data.requests)
      .reduce((map, key) => {
  
        map[key] = data.requests[key].replace(stockCid, '${clientId}')
        return map;

      }, {})

    res.json(data)

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
