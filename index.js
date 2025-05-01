#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

import inquirer from 'inquirer'
import { replaceInFileSync } from 'replace-in-file'

const TEMPLATE_REPO_URL = 'https://github.com/cubos-vtex/vtex-io-app-template'

function execCommand(command, options = {}) {
  try {
    const output = execSync(command, { stdio: 'pipe', ...options })

    return output.toString()
  } catch (e) {
    throw new Error(`Error executing command: ${command}`)
  }
}

const trimFilter = (input) => input.trim()

const validateEmpty = (input) => (input ? true : `Cannot be empty!`)

const COMMON_INPUT_OPTIONS = {
  type: 'input',
  validate: validateEmpty,
  filter: trimFilter,
}

const REQUIRED_YARN_VERSION = '1.22'

async function main() {
  console.info('\n🚀 Create VTEX IO App Setup\n')

  const yarnVersion = execCommand('yarn --version')

  if (!yarnVersion.startsWith(REQUIRED_YARN_VERSION)) {
    throw new Error(`Yarn ${REQUIRED_YARN_VERSION}.x is required.`)
  }

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

  console.info('\n✅ Cloning and customizing the template...\n')

  execCommand(`git clone --depth=1 ${TEMPLATE_REPO_URL} ${appName}`)

  const projectPath = path.join(process.cwd(), appName)

  execCommand('yarn', { cwd: projectPath })
  fs.rmSync(path.join(projectPath, '.git'), { recursive: true })
  execCommand('git init', { cwd: projectPath })

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

  const results = replaceInFileSync(options)
  const changedFiles = results.filter((r) => r.hasChanged).map((r) => r.file)

  if (changedFiles.length) {
    console.info('\n✅ Replacements have occurred in the files:')
    changedFiles.forEach((file) => console.info(`   - ${file}`))
  } else {
    console.info('\n⚠️  No replacements occurred.')
  }

  execCommand('git add .', { cwd: projectPath })
  execCommand('git commit -m "feat: initial commit"', { cwd: projectPath })
  console.info('\n✅ Created the first commit.\n')

  const { openInVsCode } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'openInVsCode',
      message: 'Do you want to open your new app folder in VS Code?',
      default: false,
    },
  ])

  if (openInVsCode) {
    console.info(`\nOpening folder "${projectPath}" in VS Code...`)
    execCommand(`code ${projectPath}`)
  }

  console.info(
    `\n🎉 Setup completed! Your project is ready in "${projectPath}".\n`
  )
}

main().catch((error) => {
  console.error('\n❌', error.message, '\n')
})
