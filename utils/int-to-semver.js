const intToSemver = (version_int = 0) => {
    const major = Math.floor(version_int / 1000000);
    const minor = Math.floor(version_int  % 1000000 / 1000);
    const patch = Math.floor(version_int  % 1000000 % 1000 );
    return `${major}.${minor}.${patch}`;
};
module.exports = intToSemver;
