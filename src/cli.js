import arg from 'arg';
import inquirer from 'inquirer';
import chalk from "chalk";
import figlet from"figlet";
import Configstore from 'configstore';
import packageJson from '../package.json';
import CLI from 'clui';
import request from 'request';
import path from 'path';
import fs from 'fs';
import Minizip from 'node-minizip';
import zipper from "zip-local";
import mv from 'mv';

// TODO: zip it to somewhere else rather than the same directory

const filename = path.basename(path.resolve())
const zipFileName = filename
let config
const status = new CLI.Spinner('Deploying, please wait...');

const init = () => {
  config = new Configstore(packageJson.name);
  console.log(
    chalk.green(
      figlet.textSync("Kodem.io",{ horizontalLayout: 'full' })
    )
  );
}

async function zip() {
  // Move node_modules
  if (fs.existsSync('node_modules/')) {
    await mv('node_modules/', '../kodem_temp_node_modules', function(err) {
    });
  }
  zipper.sync.zip(".").compress().save(zipFileName);

  // Move it back
  if (fs.existsSync('../custom_node_modules')) {
    await mv('../kodem_temp_node_modules', './node_modules', function(err) {
    });
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendZip(email) {
  var stream = fs.createReadStream(zipFileName)
  const options = {
    url: 'http://api.kodem.io/upload',
    method: 'POST',
    headers: {
      "Content-Type": "multipart/form-data"
    },
    formData: {
        "resource": stream,
        "email" : email
    },
  }

  status.start()
  try {
    await request(options, (error, res, body) => {
      if (error) console.log(error)
      else console.log(body)
      status.stop();
    });
  } catch(err) {
    console.log(err)
    status.stop();
  } finally {
    // delete zipped file
    fs.unlinkSync(zipFileName);
  }

}

async function askEmail() {
  const questions = [
    {
      type: 'input',
      name: 'email',
      message: "Enter email address",
      validate: function(value) {
        var email = value.match(
          /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i
        );
        if (email) {
          return true;
        }

        return 'Please enter a valid email address';
      }
    },
  ];

 const answers = await inquirer.prompt(questions);
 return answers;
}

async function askDeploy() {
  const questions = [
    {
      type: 'confirm',
      name: 'deploy',
      message: "Would you like to deploy a new version of " + filename,
    },
  ];

 const answers = await inquirer.prompt(questions);
 return answers;
}

function createConfig(email) {
  const json = {'email': email}

  config.set('email', email)
}

async function getEmail() {
  if (config && config.get('email')) {
    return config.get('email')
  }

  let options = await askEmail();
  createConfig(options.email)
  return options.email
}

function isPackageJsonExists() {
  if (fs.existsSync('package.json')) {
    return true
  }

  return false
}

export async function cli(args) {
  init()

  if (!isPackageJsonExists()) {
    console.log(chalk.red('File package.json does not exist in the current file path.\nMake sure you are in the correct file path.'));
    return
  }

  let answer = await askDeploy()
  if (!answer.deploy) {
    return
  }

  let email = await getEmail()

  await zip()
  sendZip(email)
}


