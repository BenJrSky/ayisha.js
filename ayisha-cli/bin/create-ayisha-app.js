#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const ora = require('ora');
const { generateProject } = require('../lib/generator');
const { getTemplates } = require('../lib/templates');

const program = new Command();

program
  .name('create-ayisha-app')
  .description('Create a new Ayisha.js application')
  .version('1.0.0');

program
  .argument('[project-name]', 'name of the project')
  .option('-t, --template <template>', 'template to use')
  .option('-m, --mode <mode>', 'development mode (cdn or modern)', 'cdn')
  .option('-y, --yes', 'skip prompts and use defaults')
  .action(async (projectName, options) => {
    console.log(chalk.blue.bold('\n🚀 Welcome to Ayisha.js CLI!\n'));

    let answers = {};

    if (!options.yes) {
      answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectName',
          message: 'Project name:',
          default: projectName || 'my-ayisha-app',
          validate: (input) => {
            if (!/^[a-zA-Z0-9-_]+$/.test(input)) {
              return 'Project name can only contain letters, numbers, hyphens, and underscores';
            }
            return true;
          }
        },
        {
          type: 'list',
          name: 'template',
          message: 'Choose a project template:',
          choices: ['Basic', 'SPA', 'Form App', 'Dashboard']
        },
        {
          type: 'list',
          name: 'mode',
          message: 'Choose development mode:',
          choices: [
            { name: 'CDN (Traditional - script tag)', value: 'cdn' },
            { name: 'Modern (ES Modules + Build tools)', value: 'modern' }
          ]
        },
        {
          type: 'confirm',
          name: 'includeExamples',
          message: 'Include example components?',
          default: true
        },
        {
          type: 'confirm',
          name: 'setupGit',
          message: 'Initialize git repository?',
          default: true
        }
      ]);
    } else {
      answers = {
        projectName: projectName || 'my-ayisha-app',
        mode: options.mode || 'cdn',
        template: options.template || 'basic',
        includeExamples: true,
        setupGit: true
      };
    }

    const spinner = ora('Creating project...').start();

    try {
      // Pass mode to generateProject
      await generateProject({
        projectName,
        template: answers.template,
        mode: answers.mode,
        includeExamples: answers.includeExamples,
        setupGit: answers.setupGit
      });
      spinner.succeed(chalk.green('Project created successfully!'));
      
      console.log(chalk.yellow('\n📁 Next steps:'));
      console.log(chalk.white(`  cd ${answers.projectName}`));
      
      if (answers.mode === 'modern') {
        console.log(chalk.white('  npm install'));
        console.log(chalk.white('  npm run dev'));
        console.log(chalk.white('  # Your app will be available at http://localhost:3000\n'));
      } else {
        console.log(chalk.white('  # Open index.html in your browser'));
        console.log(chalk.white('  # Or use a local server like Live Server\n'));
      }
      
      console.log(chalk.blue('🎉 Happy coding with Ayisha.js!'));
    } catch (error) {
      spinner.fail(chalk.red('Failed to create project'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

program.parse();