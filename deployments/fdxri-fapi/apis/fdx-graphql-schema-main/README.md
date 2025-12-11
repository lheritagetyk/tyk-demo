# Financial Data Exchange (FDX) GraphQL API

Repository for FDX GraphQL artifacts under source control.  Originally contributed by Katie Volz of M&T Bank.

# Official Disclaimers

Source for these legal notices is on FDX Confluence page
[FDX API schema validation tools](https://fdx.atlassian.net/wiki/spaces/FDX/pages/2870476802/FDX+API+schema+validation+tools).

## Legal Notices

Financial Data Exchange, LLC (FDX) is a standards body and provides these Schema Validation Tools
for general use among industry stakeholders. Many of the terms, however, are subject to additional
interpretations under prevailing laws, industry norms, and/or governmental regulations. While referencing
certain laws that may be applicable, readers, users, members, or any other parties should seek legal
advice of counsel relating to their particular practices and applicable laws in the jurisdictions where
they do business. See FDX's complete Legal Disclaimer located at http://www.financialdataexchange.org
for other applicable disclaimers. The information provided herein is for educational purposes only and
is not intended to be a guide for any specific company. Each company should consult with its own legal,
IT, data security, financial, tax, and other advisors before implementing any programs described herein.
References to the U.S. market, U.S. laws, and the like, will require certain modification or analysis to
confirm applicability in other jurisdictions.

## FDX API License Agreement

Use of any of the tools listed here are subject to your acceptance of the FDX API License Agreement,
as amended.  The FDX API License Agreement, as well as your acceptance of the FDX Terms of Use, and
FDX Privacy Policy must first be accepted by contacting FDX at https://www.financialdataexchange.org
and selecting "Get Started" before using any of the FDX API Schema Validation Tools.

## References to Other Software, Toolsets, and Open Source Materials

References to other sites, sample code, and resources provided by third parties are provided for your
convenience only and shall not be deemed an endorsement nor recommendation by FDX. Each party is
subject to complying with all applicable license agreements and FDX grants no such rights. Any use of
these open source tools and other materials referenced here are governed by each tool's own license.
Refer to and understand those licenses before adopting and using in your environment at your own risk
and obligation for compliance thereto. We have no control over the contents of those sites or resources
and accept no responsibility for them or for any loss or damage that may arise from your use of them.
If you decide to access any of the third-party websites linked herein, software, toolsets, sample code,
and/or open source materials, you do so entirely at your own risk and subject to the terms and
conditions of use for such websites and third-party rights. FDX asserts no ownership, copyright,
or other claims to any third-party materials, software, or other tools referenced or mentioned herein.

# Contributing

This repository follows the Gitflow Workflow
(https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow).
Before contributing, you should familiarize yourself with this workflow,
especially regarding feature branching and pull requests.

## Gitflow Workflow Example Commands

### Initial Set Up

```bash
# Go to your local code folder
cd dev
# Clone the repository
# Use the Clone button in the upper-right corner of 
# https://bitbucket.org/fdxdev/fdxapi/src/main/
git clone https://yourusername@bitbucket.org/fdxdev/fdxapi.git
```
<!-- TODO set upper URL to correct-->

### For each unit of change being made

### Proposed Branching Model
#### "develop"
* There will be two primary branches - main and develop
* All work is carried out via feature branches
* A feature branch must be created for any new work e.g., modification of a tax form
* A feature branch is always created off the develop branch
* A feature branch is to be named as `feature-<RFC number>-<feature name>` or `feature-<JIRA number>`
* A feature branch must always merge back into develop branch
* All of paths, parameters and schemas sections should be kept in alphabetical order

```bash
# Go to develop branch - ALWAYS START HERE IN develop BRANCH!
git checkout develop
# Make sure up-to-date
git pull origin develop

# Create a feature branch
git checkout -b feature/rfc-0xxx-short-name

# Edit feature content

# Periodically, integrate any changes
git pull origin develop

# When ready, create pull request for feature.
git add --all
git commit -m "Explanation"
git status
git push origin feature/rfc-0xxx-short-name

# Git will show a link to a pull request form.
# Complete the form. Submit the request.

# After pull request is merged
# Remove your local feature branch

# Go back to develop branch
git checkout develop
# List your local branches
git branch
# Delete the branch
git branch -d feature/rfc-0xxx-short-name 

```
