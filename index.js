#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

import inquirer from 'inquirer'
import { replaceInFileSync } from 'replace-in-file'

const TEMPLATE_REPO_URL = 'https://github.com/cubos-vtex/vtex-io-app-template'

function execCommand(command, options = {}) {
  try {
    execSync(command, { stdio: 'inherit', ...options })
  } catch (e) {
    throw new Error(`Error executing command: ${command}`)
  }
}

async function main() {
  console.info('\n🚀 Create VTEX IO App Setup\n')

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'appName',
      message: 'What is the app name?',
      validate: (input) => (input ? true : 'App name cannot be empty!'),
    },
    {
      type: 'input',
      name: 'appVendor',
      message: 'What is the app vendor?',
      default: 'ssesandbox04',
      validate: (input) => (input ? true : 'App vendor cannot be empty!'),
    },
    {
      type: 'input',
      name: 'appTitle',
      message: 'What is the app title?',
      validate: (input) => (input ? true : 'App title cannot be empty!'),
    },
    {
      type: 'input',
      name: 'appDescription',
      default: '',
      message: 'What is the app description?',
    },
  ])

  const { appName, appVendor, appTitle, appDescription } = answers

  console.info('\n✅ Cloning template...\n')

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
    to: [
      appName.trim(),
      appVendor.trim(),
      appTitle.trim(),
      appDescription.trim().endsWith('.') || !appDescription.trim()
        ? appDescription.trim()
        : `${appDescription.trim()}.`,
    ],
  }

  const results = replaceInFileSync(options)
  const changedFiles = results.filter((r) => r.hasChanged).map((r) => r.file)

  if (changedFiles.length) {
    console.info('\n✅ Replacements have occurred in the files:')
    changedFiles.forEach((file) => console.info(`   - ${file}`))
  } else {
    console.info('\n⚠️  No replacements occurred.')
  }

  console.info('\n✅ Creating first commit...\n')

  execCommand('git add .', { cwd: projectPath })
  execCommand('git commit -m "feat: initial commit"', { cwd: projectPath })

  console.info('\n🎉 Setup completed!\n')
}

main().catch((error) => {
  console.error('\n❌', error.message)
})
