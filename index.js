#!/usr/bin/env node

import { exec } from 'child_process'
import fs from 'fs'
import { styleText } from 'node:util'
import path from 'path'

import { Octokit } from '@octokit/rest'
import fsExtra from 'fs-extra'
import inquirer from 'inquirer'
import { replaceInFileSync } from 'replace-in-file'
import yargs from 'yargs'

import { getGitHubToken } from './github-auth.js'

const REPOSITORY_URL = 'https://github.com/cubos-vtex/create-vtex-io-app'
const TEMPLATE_REPO_URL = 'https://github.com/cubos-vtex/vtex-io-app-template'
const NEXT_STEPS_URL = `${REPOSITORY_URL}/blob/main/NEXT-STEPS.md`
const NODE_VERSION_REGEX = /^v(\d+)\./
const REQUIRED_NODE_MIN_VERSION = 18
const REQUIRED_NODE_MESSAGE = `Node >= ${REQUIRED_NODE_MIN_VERSION} is required`
const REQUIRED_NPM_MESSAGE = 'NPM is required'
const REQUIRED_YARN_VERSION = '1.22'
const REQUIRED_YARN_MESSAGE = `Yarn ${REQUIRED_YARN_VERSION}.x is required`
const REQUIRED_GIT_MESSAGE = 'Git is required'
const JOIN_REQUIREMENTS_ERROR = '\n   - '
const KEBAB_REGEX = /^(?![\d-])[a-z\d]+[a-z\d-]*(?<!-)$/
const ALPHANUMERIC_REGEX = /^[a-z\d]+$/
const OPTIONAL_LABEL = styleText('dim', '(optional)')

const trimFilter = (input) => input.trim()
const validateEmpty = (input) => !!trimFilter(input)
const highlightOutput = (text) => styleText('cyan', text)
const successOutuput = (text) =>
  styleText('bold', styleText(['greenBright'], text))

const logStepSuccess = (text) => console.info(`✅ ${text}`)
const logStepWarning = (text) => console.info(`⚠️  ${text}`)

const COMMON_INPUT_OPTIONS = {
  type: 'input',
  validate: validateEmpty,
  filter: trimFilter,
}

async function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    exec(command, { ...options }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Error executing command "${command}":\n\n${stderr}`))
      } else {
        resolve(stdout)
      }
    })
  })
}

async function checkRequirements() {
  const dependencyErrors = []

  await execCommand('node --version')
    .then((nodeVersion) => {
      const [, nodeVersionNumber] = NODE_VERSION_REGEX.exec(nodeVersion)

      if (+nodeVersionNumber < REQUIRED_NODE_MIN_VERSION) {
        dependencyErrors.push(REQUIRED_NODE_MESSAGE)
      }
    })
    .catch(() => dependencyErrors.push(REQUIRED_NODE_MESSAGE))

  await execCommand('npm --version').catch(() =>
    dependencyErrors.push(REQUIRED_NPM_MESSAGE)
  )

  await execCommand('yarn --version')
    .then((yarnVersion) => {
      if (!yarnVersion.startsWith(REQUIRED_YARN_VERSION)) {
        dependencyErrors.push(REQUIRED_YARN_MESSAGE)
      }
    })
    .catch(() => dependencyErrors.push(REQUIRED_YARN_MESSAGE))

  await execCommand('git --version').catch(() =>
    dependencyErrors.push(REQUIRED_GIT_MESSAGE)
  )

  if (dependencyErrors.length) {
    throw new Error(
      `Error while checking requirements:\n${JOIN_REQUIREMENTS_ERROR}${dependencyErrors.join(
        JOIN_REQUIREMENTS_ERROR
      )}`
    )
  }
}

async function hasVsCode() {
  return execCommand('code --version').catch(() => false)
}

async function hasGitUser() {
  const hasUserName = await execCommand('git config --get user.name')
    .then((output) => !!output.trim())
    .catch(() => false)

  const hasUserEmail = await execCommand('git config --get user.email')
    .then((output) => !!output.trim())
    .catch(() => false)

  return hasUserName && hasUserEmail
}

async function verifyVTEXAccount(account) {
  return fetch(
    `https://${account}.myvtex.com/api/sessions?items=account.accountName`
  ).then((r) => r.ok)
}

async function main() {
  console.info(`\n🚀 ${successOutuput('Create VTEX IO App')}\n`)
  await checkRequirements()

  const { appName, appVendor, appTitle, appDescription } =
    await inquirer.prompt([
      {
        ...COMMON_INPUT_OPTIONS,
        name: 'appVendor',
        message: 'What is the app vendor?',
        validate: async (input) => {
          if (!COMMON_INPUT_OPTIONS.validate(input)) {
            return false
          }

          const account = COMMON_INPUT_OPTIONS.filter(input)

          if (!ALPHANUMERIC_REGEX.test(account)) {
            return 'Invalid app vendor. Use lowercase letters and numbers only.'
          }

          const accountExists = await verifyVTEXAccount(account)

          if (!accountExists) {
            return `VTEX account "${account}" does not exist. The app vendor must be an existing account.`
          }

          return true
        },
      },
      {
        ...COMMON_INPUT_OPTIONS,
        name: 'appName',
        message: 'What is the app name?',
        validate: (input) => {
          if (!COMMON_INPUT_OPTIONS.validate(input)) {
            return false
          }

          if (!KEBAB_REGEX.test(COMMON_INPUT_OPTIONS.filter(input))) {
            return 'Invalid app name. Use kebab-case (lowercase letters and hyphens only). Do not start with a number or hyphen, and avoid special characters.'
          }

          return true
        },
      },
      {
        ...COMMON_INPUT_OPTIONS,
        name: 'appTitle',
        message: 'What is the app title?',
      },
      {
        ...COMMON_INPUT_OPTIONS,
        validate: undefined,
        name: 'appDescription',
        default: '',
        message: `What is the app description? ${OPTIONAL_LABEL}`,
        filter: (input) => {
          const description = COMMON_INPUT_OPTIONS.filter(input)

          return description.endsWith('.') ||
            description.endsWith('!') ||
            description.endsWith('?') ||
            !description
            ? description
            : `${description}.`
        },
      },
    ])

  const projectPath = path.join(process.cwd(), appName)
  const projectReactPath = path.join(projectPath, 'react')
  const projectNodePath = path.join(projectPath, 'node')
  const outputProjectPath = highlightOutput(projectPath)

  const { argv } = yargs(process.argv)
  const { t, templateDirectory = t, templatePath = templateDirectory } = argv

  console.info()

  if (templatePath) {
    logStepSuccess(`Copying the template to ${outputProjectPath}`)
    await fsExtra.copy(templatePath, appName)
  } else {
    logStepSuccess(`Cloning the template to ${outputProjectPath}`)
    await execCommand(`git clone --depth=1 ${TEMPLATE_REPO_URL} ${appName}`)
  }

  logStepSuccess('Installing dependencies')
  await execCommand('yarn', { cwd: projectPath })
  await execCommand('yarn', { cwd: projectReactPath })
  await execCommand('yarn', { cwd: projectNodePath })
  await execCommand('npm rebuild', { cwd: projectPath })

  logStepSuccess('Initializing git')
  fs.rmSync(path.join(projectPath, '.git'), { recursive: true })
  await execCommand('git init', { cwd: projectPath })
  await execCommand('git branch -M main', { cwd: projectPath })

  console.info()

  const { createRepo } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'createRepo',
      message: 'Do you want to create a GitHub repository for the new app?',
      default: true,
    },
  ])

  console.info()

  let repositoryOwner = ''
  let githubUser = ''
  let repositoryUrl = '<APP_REPOSITORY_URL>'
  let repositoryUrlOutput = ''

  if (createRepo) {
    logStepSuccess('Creating GitHub repository')

    const githubToken = await getGitHubToken()
    const octokit = new Octokit({ auth: githubToken })

    const {
      data: { login },
    } = await octokit.rest.users.getAuthenticated().catch(() => {
      throw new Error('Invalid GitHub token')
    })

    githubUser = login
    repositoryOwner = login

    console.info()

    let { createInOrg } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'createInOrg',
        message: 'Do you want to create the repository in an organization?',
        default: false,
      },
    ])

    console.info()

    let repo

    if (createInOrg) {
      const { data: orgs } = await octokit.rest.orgs.listForAuthenticatedUser()

      if (orgs.length > 0) {
        const { org } = await inquirer.prompt([
          {
            type: 'list',
            name: 'org',
            message: 'Which organization?',
            choices: orgs.map((o) => o.login),
          },
        ])

        console.info()

        const { data } = await octokit.rest.repos.createInOrg({
          org,
          name: appName,
          description: appDescription,
        })

        repositoryOwner = org

        repo = data
      } else {
        logStepWarning('You have no organizations')

        createInOrg = false
      }
    }

    if (!createInOrg) {
      logStepSuccess('Creating the repository in your personal account')
      const { data } = await octokit.rest.repos.createForAuthenticatedUser({
        name: appName,
        description: appDescription,
      })

      repo = data
    }

    repositoryUrl = repo.html_url
    repositoryUrlOutput = highlightOutput(repositoryUrl)

    logStepSuccess(`Repository successfully created at ${repositoryUrlOutput}`)

    await execCommand(`git remote add origin ${repositoryUrl}`, {
      cwd: projectPath,
    })
  }

  logStepSuccess('Customizing the template')
  replaceInFileSync({
    files: [
      `${projectPath}/**/*.{json,md,ts,tsx}`,
      `${projectPath}/.all-contributorsrc`,
    ],
    ignore: `${projectPath}/**/node_modules/**`,
    from: [
      /<APP_NAME>/g,
      /<APP_VENDOR>/g,
      /<APP_TITLE>/g,
      /<APP_DESCRIPTION>/g,
      /<APP_REPOSITORY_OWNER>/g,
      /<APP_REPOSITORY_URL>/g,
    ],
    to: [
      appName,
      appVendor,
      appTitle,
      appDescription,
      repositoryOwner,
      repositoryUrl,
    ],
  })

  const gitOK = await hasGitUser()

  if (gitOK) {
    logStepSuccess('Creating the first commit')
    await execCommand('git add .', { cwd: projectPath })
    await execCommand(
      `git commit -m "feat: initial template by ${REPOSITORY_URL}"`,
      { cwd: projectPath }
    )

    if (createRepo) {
      logStepSuccess(`Adding ${githubUser} as a contributor`)

      await execCommand(`npx all-contributors add ${githubUser} code,doc`, {
        cwd: projectPath,
      })

      await execCommand('npx prettier --write docs/README.md', {
        cwd: projectPath,
      })

      await execCommand(
        'npx prettier --write .all-contributorsrc --parser json-stringify',
        {
          cwd: projectPath,
        }
      )

      await execCommand('git add .', { cwd: projectPath })
      await execCommand('git commit --amend --no-edit', { cwd: projectPath })

      logStepSuccess(`Pushing to GitHub at ${repositoryUrlOutput}`)
      await execCommand('git push -u -f origin main', { cwd: projectPath })
    }
  } else {
    console.info()
    logStepWarning(
      'Unable to create the first commit. Add a git user name and email with these commands to create the first commit later:'
    )
    console.info('   - git config --global --add user.name "Your Name"')
    console.info('   - git config --global --add user.name "your@email.com"\n')
  }

  if (await hasVsCode()) {
    console.info()

    const { openInVsCode } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'openInVsCode',
        message: 'Do you want to open your new app folder in VS Code?',
        default: false,
      },
    ])

    if (openInVsCode) {
      console.info()
      logStepSuccess(`Opening folder ${outputProjectPath} in VS Code`)
      await execCommand(`code ${projectPath}`)
    }
  }

  console.info(
    `\n🎉 ${successOutuput(
      'Setup completed!'
    )} Your project is ready to start in ${outputProjectPath}`
  )

  if (createRepo) {
    console.info(
      `\nThe project is also available on GitHub at ${repositoryUrlOutput}`
    )
  }

  console.info(
    `\n📌 ${styleText('bold', 'Next steps:')} ${highlightOutput(
      NEXT_STEPS_URL
    )}\n`
  )
}

main().catch((error) => {
  console.error('\n❌', error.message, '\n')
})
