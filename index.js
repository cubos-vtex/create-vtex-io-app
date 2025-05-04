#!/usr/bin/env node

import { exec } from 'child_process'
import fs from 'fs'
import { styleText } from 'node:util'
import path from 'path'

import inquirer from 'inquirer'
import { replaceInFileSync } from 'replace-in-file'

const TEMPLATE_REPO_URL = 'https://github.com/cubos-vtex/vtex-io-app-template'
const NODE_VERSION_REGEX = /^v(\d+)\./
const REQUIRED_NODE_MIN_VERSION = 18
const REQUIRED_NODE_MESSAGE = `node >= ${REQUIRED_NODE_MIN_VERSION} is required`
const REQUIRED_YARN_VERSION = '1.22'
const REQUIRED_YARN_MESSAGE = `yarn ${REQUIRED_YARN_VERSION}.x is required`
const REQUIRED_GIT_MESSAGE = 'git is required'
const JOIN_REQUIREMENTS_ERROR = '\n   - '
const trimFilter = (input) => input.trim()
const validateEmpty = (input) => (input ? true : `Cannot be empty!`)
const highlightOutput = (text) => styleText('cyan', text)
const successOutuput = (text) =>
  styleText('bold', styleText(['greenBright'], text))

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

async function main() {
  console.info(`\n🚀 ${successOutuput('Create VTEX IO App Setup')}\n`)
  await checkRequirements()

  const { appName, appVendor, appTitle, appDescription } =
    await inquirer.prompt([
      {
        ...COMMON_INPUT_OPTIONS,
        name: 'appName',
        message: 'What is the app name?',
      },
      {
        ...COMMON_INPUT_OPTIONS,
        name: 'appVendor',
        message: 'What is the app vendor?',
        default: 'ssesandbox04',
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
        message: 'What is the app description?',
        filter: (input) => {
          const description = trimFilter(input)

          return description.endsWith('.') || !description
            ? description
            : `${description}.`
        },
      },
    ])

  const projectPath = path.join(process.cwd(), appName)
  const outputProjectPath = highlightOutput(projectPath)

  console.info(`\n✅ Cloning the template to ${outputProjectPath}`)
  await execCommand(`git clone --depth=1 ${TEMPLATE_REPO_URL} ${appName}`)

  console.info('✅ Installing dependencies')
  await execCommand('yarn', { cwd: projectPath })
  fs.rmSync(path.join(projectPath, '.git'), { recursive: true })
  await execCommand('git init', { cwd: projectPath })

  const options = {
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
  }

  console.info('✅ Customizing the template')
  const results = replaceInFileSync(options)
  const changedFiles = results.filter((r) => r.hasChanged).map((r) => r.file)

  if (changedFiles.length) {
    console.info('✅ Replacements have occurred in the files:')
    changedFiles.forEach((file) =>
      console.info(`   - ${highlightOutput(file)}`)
    )
  } else {
    console.info('⚠️ No replacements occurred')
  }

  console.info('✅ Creating the first commit\n')
  await execCommand('git add .', { cwd: projectPath })
  await execCommand('git commit -m "feat: initial commit"', {
    cwd: projectPath,
  })

  const { openInVsCode } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'openInVsCode',
      message: 'Do you want to open your new app folder in VS Code?',
      default: false,
    },
  ])

  if (openInVsCode) {
    console.info(`\n✅ Opening folder ${outputProjectPath} in VS Code`)
    await execCommand(`code ${projectPath}`)
  }

  console.info(
    `\n🎉 ${successOutuput(
      'Setup completed!'
    )} Your project is ready to start in ${outputProjectPath}`
  )

  const [
    outputVtexLogin,
    outputVtexUse,
    outputVtexLink,
    outuputRoute,
    outputCustomPage,
  ] = [
    'vtex login {{accountName}}',
    'vtex use {{workspaceName}}',
    'vtex link',
    `/_v/${appName}/get-repositories-by-org/:org`,
    `https://{{workspaceName}}--{{accountName}}.myvtex.com/${appName}/list-repositories`,
  ].map(highlightOutput)

  console.info(`\n📌 ${styleText('bold', 'Next steps:')}

   - Go to the ${outputProjectPath} folder
   - Authenticate to vtex-cli using a VTEX account where you want to run the new app: ${outputVtexLogin}
   - Create a workspace: ${outputVtexUse}
   - Link the new app: ${outputVtexLink}
   - Then you will have some samples to start your project:
      - Route ${outuputRoute} in the backend capable of retrieving the repositories of a GitHub organization
      - Custom page containing a custom block at the URL ${outputCustomPage}\n`)
}

main().catch((error) => {
  console.error('\n❌', error.message, '\n')
})
