#!/usr/bin/env node

import { exec } from 'child_process'
import fs from 'fs'
import { styleText } from 'node:util'
import path from 'path'

import fsExtra from 'fs-extra'
import inquirer from 'inquirer'
import { replaceInFileSync } from 'replace-in-file'
import yargs from 'yargs'

const TEMPLATE_REPO_URL = 'https://github.com/cubos-vtex/vtex-io-app-template'
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
const VTEX_COMMANDS = {
  login: 'vtex login {{accountName}}',
  use: 'vtex use {{workspaceName}}',
  link: 'vtex link --clean',
}

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

  logStepSuccess('Initializing git')
  fs.rmSync(path.join(projectPath, '.git'), { recursive: true })
  await execCommand('git init', { cwd: projectPath })

  logStepSuccess('Installing dependencies')
  await execCommand('yarn', { cwd: projectPath })
  await execCommand('npm rebuild', { cwd: projectPath })

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
    ],
    to: [appName, appVendor, appTitle, appDescription],
  })

  const gitOK = await hasGitUser()

  if (gitOK) {
    logStepSuccess('Creating the first commit\n')
    await execCommand('git add .', { cwd: projectPath })
    await execCommand(
      'git commit -m "feat: initial template by create-vtex-io-app"',
      { cwd: projectPath }
    )
  } else {
    console.info()
    logStepWarning(
      'Unable to create the first commit. Add a git user name and email with these commands to create the first commit later:'
    )
    console.info('   - git config --global --add user.name "Your Name"')
    console.info('   - git config --global --add user.name "your@email.com"\n')
  }

  if (await hasVsCode()) {
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

  function getBackendResourceOutput(resourceType, resource, description) {
    return `${resourceType} ${resource} in the backend to ${description}`
  }

  function getCustomPageOutput(page, resourceType, resource) {
    const prefix = 'Custom page containing a custom block at the URL'
    const baseUrl = 'https://{{workspaceName}}--{{accountName}}.myvtex.com'
    const pageUrl = highlightOutput(`${baseUrl}/${appName}/${page}`)
    const suffix = `consuming the ${resourceType} ${resource}`

    return `${prefix} ${pageUrl} ${suffix}`
  }

  const outputVtexLogin = highlightOutput(VTEX_COMMANDS.login)
  const outputVtexUse = highlightOutput(VTEX_COMMANDS.use)
  const outputVtexLink = highlightOutput(VTEX_COMMANDS.link)

  const outuputGithubRepositoriesRoute = highlightOutput(
    `/_v/${appName}/get-repositories-by-org/:org`
  )

  const outputListRepositoriesRoute = getBackendResourceOutput(
    'Route',
    outuputGithubRepositoriesRoute,
    'list the repositories of a GitHub organization'
  )

  const outputCustomPageGithub = getCustomPageOutput(
    'list-repositories',
    'route',
    outuputGithubRepositoriesRoute
  )

  const outputGithubRepositoriesQueryGraphQL = highlightOutput(
    'getGitHubRepositoriesByOrg'
  )

  const outputListRepositoriesGraphQL = getBackendResourceOutput(
    'GraphQL query',
    outputGithubRepositoriesQueryGraphQL,
    'list the repositories of a GitHub organization'
  )

  const outputCustomPageGithubGraphQL = getCustomPageOutput(
    'list-repositories-graphql',
    'GraphQL query',
    outputGithubRepositoriesQueryGraphQL
  )

  const outuputTasksRoute = highlightOutput(`/_v/${appName}/tasks`)
  const outputCreateListTasks = getBackendResourceOutput(
    'Route',
    outuputTasksRoute,
    'create a task or list tasks'
  )

  const outuputTasksIdRoute = highlightOutput(`/_v/${appName}/tasks/:id`)
  const outputGetUpdateDeleteTasks = getBackendResourceOutput(
    'Route',
    outuputTasksIdRoute,
    'get, update or delete a task'
  )

  const outputCustomPageTasks = getCustomPageOutput(
    'tasks',
    'routes',
    `${outuputTasksRoute} and ${outuputTasksIdRoute}`
  )

  console.info(`\n📌 ${styleText('bold', 'Next steps:')}

   - Go to the ${outputProjectPath} folder in the terminal
   - Authenticate to vtex-cli using a VTEX account where you want to run the new app: ${outputVtexLogin}
   - Create a workspace: ${outputVtexUse}
   - Link the new app: ${outputVtexLink}\n
   Then you will have some samples to start your project:\n
      - ${outputListRepositoriesRoute}
      - ${outputCustomPageGithub}
      - ${outputListRepositoriesGraphQL}
      - ${outputCustomPageGithubGraphQL}
      - ${outputCreateListTasks}
      - ${outputGetUpdateDeleteTasks}
      - ${outputCustomPageTasks}\n`)
}

main().catch((error) => {
  console.error('\n❌', error.message, '\n')
})
