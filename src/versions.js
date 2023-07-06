function exportableVersions (versions) {
  const result = [];
  for (const version of versions) {
    result[version] = require(`./v${version}`);
  }
  return result;
}

module.exports = exportableVersions([2, 3]);
