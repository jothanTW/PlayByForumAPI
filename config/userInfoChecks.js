const usernamelen = 4;
const usernamemax = 24;
const usernameregex = /[^a-z0-9]+/gi;
const passmin = 6;
const passmax = 50;
const passregex = /[^a-z0-9!?@#$%]/gi;
const emailregex = /^.+@.+$/gi

exports.checkUserName = function(name) {
    if (name.length < usernamelen)
        return "Username too short, must be at least " + usernamelen + " characters";
    if (name.length > usernamemax)
        return "Username too long, max " + usernamemax + " characters";
    let usernamebadchars = name.match(usernameregex);
    if (usernamebadchars) {
        return "Username cannot contain these character sequences: " + usernamebadchars;
    }
    return '';
}

exports.checkEmail = function(email) {
    if (!emailregex.test(email)) {
        console.log(email);
        return "Invalid email address";
    }
    return '';
}

exports.checkPassword = function(pass) {
    if (pass.length < passmin)
        return "Password too short, must be at least " + passmin + " characters";
    if (pass.length > passmax)
        return "Password too long, max " + passmax + " characters";
    let passwordbadchars = pass.match(passregex);
    if (passwordbadchars) {
        return "Password cannot contain these character sequences: " + passwordbadchars;
    }
    return '';
}