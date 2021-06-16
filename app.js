require('dotenv').config()
const axios = require('axios')
const {  Parser } = require('json2csv');
const fs = require('fs');
const prompt = require('prompt');

prompt.start();

prompt.get([
  {
    name: 'release',
    description: 'What is the release name of this review ?',
    type: 'string',
  }
],  (_err, result) => {
  try {
    onInit(result.release)
  } catch (error) {
    return onError(error)
  }
});


const USER_EMAIL = process.env.JIRA_EMAIL
const USER_TOKEN = process.env.JIRA_TOKEN
const PROJECT_KEY = process.env.JIRA_PROJECT_KEY

const getIssuesByProject = async ({projectKey}) => {
  try {
    const result = await axios.get(`https://payfit.atlassian.net/rest/api/2/search?jql=project="${projectKey}"`, {
      auth: {
        username: USER_EMAIL,
        password: USER_TOKEN
      }
    })
    
    if (!result.statusText === "OK") {
      throw Error(result)
    }
    return result.data.issues

  } catch (error) {
    console.error(error)
  }
}

const getEpicLinkFromIssue = async (id) => {
  try {
    const result = await axios.get(`https://payfit.atlassian.net/rest/api/2/issue/${id}?fields=customfield_10011`, {
      auth: {
        username: USER_EMAIL,
        password: USER_TOKEN
      }
    })

    if (!result.statusText === "OK") {
      throw Error(result)
    }
  
    return result.data.fields.customfield_10011
  } catch (error) {
    
  }
}

const formatData = async ({issues, releaseName}) => {
  const currentIssues = issues.filter((issue) => issue.fields.status.name === "Product review")
  const formattedIssues = []

  for (let i = 0; i < currentIssues.length; i++) {
    const issue = currentIssues[i];
    
    const epicId = issue.fields.customfield_10014
    const epic = await getEpicLinkFromIssue(epicId)

    const item = {
      Name: epic ? `[${epic}] - ${issue.fields.summary}` : issue.fields.summary,
      Contributor: undefined,
      Date: new Date().toLocaleDateString("en"),
      'Jira link': `https://payfit.atlassian.net/browse/${issue.key}`,
      Status: "✨ New to review",
      Ticket: issue.key,
      Release: releaseName ?? undefined
    }

    formattedIssues.push(item)
  }

  return formattedIssues
} 

const exportToCsv = async (fields) => {
  const json2csvParser = new Parser();
  const csv = await json2csvParser.parse(fields)
  
  if (csv) {
    fs.writeFile(`project-${PROJECT_KEY}.csv`, csv, (err) => {
      if (err) throw err;
      console.log('File .csv saved 🚀.');
    });
  }
}

const onInit = async (releaseName) => {  
  const issues = await getIssuesByProject({ projectKey: PROJECT_KEY })
  const formattedIssues = await formatData({issues, releaseName})

  if (formattedIssues.length <= 0) {
    return console.log('No new tickets to review 🐬')
  }

  exportToCsv(formattedIssues)
}


const onError =(err) => {
  console.log(err);
  return 1;
}
