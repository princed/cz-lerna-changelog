import conventionalPrompt from 'cz-conventional-changelog/prompt';
import conventionalFormat from 'cz-conventional-changelog/format';

import PackageUtilities from '@ahfarmer/lerna/lib/PackageUtilities';
import Repository from '@ahfarmer/lerna/lib/Repository';

import shell from 'shelljs';
import path from 'path';

function getAllPackages () {
  return PackageUtilities.getPackages(new Repository());
}

function getChangedPackages () {
  const changedFiles = shell.exec('git diff --cached --name-only', {silent: true})
    .stdout
    .split('\n');

  return getAllPackages()
    .filter(function (pkg) {
      const packagePrefix = path.relative('.', pkg.location) + path.sep;
      for (let changedFile of changedFiles) {
        if (changedFile.indexOf(packagePrefix) === 0) {
          return true;
        }
      }
    })
    .map(function (pkg) {
      return pkg.name
    });
}

module.exports = {
  prompter: function(cz, options, commit) {
    if (typeof options === 'function') {
      commit = options;
      options = {};
    }

    console.log('\n' + conventionalFormat.help + '\n');

    const allPackages = getAllPackages().map((pkg) => pkg.name);

    conventionalPrompt(cz, options, (conventionalAnswers) => {
      const conventionalChangelogEntry = conventionalFormat.format(conventionalAnswers);

      cz.prompt({
        type: 'checkbox',
        name: 'packages',
        'default': getChangedPackages(),
        choices: allPackages,
        message: `The packages that this commit has affected (${getChangedPackages().length} detected)\n`,
        validate: function (input) {
          const type = conventionalAnswers.type;
          const isRequired = ['feat', 'fix'].indexOf(type) > -1;
          const isProvided = input.length > 0;
          return isRequired ? (isProvided ? true : `Commit type "${type}" must affect at least one component`) : true;
        }
      }).then(function (packageAnswers) {
        const messages = [
          conventionalChangelogEntry.head
        ];

        const selectedPackages = packageAnswers.packages;
        if (selectedPackages && selectedPackages.length) {
          messages.push('affects: ' + selectedPackages.join(', '));
        }

        messages.push(conventionalChangelogEntry.body);
        messages.push(conventionalChangelogEntry.footer);

        const commitMessage = messages.join('\n\n');

        console.log(commitMessage);

        commit(commitMessage);
      });
    });
  }
};
