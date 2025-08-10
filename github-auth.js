import { styleText } from 'node:util'

import axios from 'axios'
import open from 'open'

const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code'
const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/access_token'
const CLIENT_ID = 'Ov23lijFMJGtxEKoBHgm'
const SCOPES = ['repo', 'user']
const GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code'

const highlightOutput = (text) => styleText('cyan', text)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function pollForToken(deviceCode, interval) {
  let currentInterval = interval

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    await delay(currentInterval * 1000)

    try {
      // eslint-disable-next-line no-await-in-loop
      const { data } = await axios.post(
        GITHUB_OAUTH_URL,
        {
          client_id: CLIENT_ID,
          device_code: deviceCode,
          grant_type: GRANT_TYPE,
        },
        { headers: { Accept: 'application/json' } }
      )

      if (data.error) {
        if (data.error === 'authorization_pending') {
          continue
        }

        if (data.error === 'slow_down') {
          currentInterval += 5
          continue
        }

        throw new Error(data.error_description || data.error)
      }

      return data.access_token
    } catch (err) {
      if (
        err.response &&
        err.response.data &&
        err.response.data.error_description
      ) {
        throw new Error(err.response.data.error_description)
      }

      if (err instanceof Error) {
        throw err
      }

      throw new Error('An unknown error occurred during authentication.')
    }
  }
}

export async function getGitHubToken() {
  try {
    const { data } = await axios.post(
      GITHUB_DEVICE_CODE_URL,
      { client_id: CLIENT_ID, scope: SCOPES.join(' ') },
      { headers: { Accept: 'application/json' } }
    )

    const {
      user_code: userCode,
      verification_uri: verificationUri,
      interval,
      device_code: deviceCode,
      expires_in: expiresIn,
    } = data

    console.info(
      `\nPlease go to ${highlightOutput(
        verificationUri
      )} and enter the code: ${highlightOutput(userCode)}`
    )
    console.info(`This code expires in ${Math.floor(expiresIn / 60)} minutes.`)
    console.info(
      'Opening your default browser to complete the authentication...'
    )

    await open(verificationUri)

    const token = await pollForToken(deviceCode, interval)

    console.info('You are authenticated on GitHub successfully')

    return token
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'An unknown error occurred.'

    throw new Error(`GitHub authentication failed: ${message}`)
  }
}
