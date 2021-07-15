module.exports.registerValidator = (
  username,
  email,
  password,
  confirmPassword
) => {
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
  const usernameRegex = /^([a-zA-Z0-9._])*$/;
  const errors = {};

  if (username.trim() === "") {
    errors.username = "Username can't be empty.";
  } else if (!username.match(usernameRegex)) {
    errors.username = "Invalid username.";
  }
  if (email.trim() === "") {
    errors.email = "Email can't be empty.";
  } else if (!email.match(emailRegex)) {
    errors.email = "Invalid email.";
  }
  if (password.trim() === "") {
    errors.password = "Password can't be empty.";
  } else if (password.length < 8) {
    errors.password = "Password should have more than 8 characters";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords should match.";
  }

  const valid = Object.keys(errors).length > 0 ? false : true;
  return {
    valid,
    errors,
  };
};

module.exports.loginValidator = (username, password) => {
  const errors = {};
  if (username.trim() === "") {
    errors.username = "Username can't be empty.";
  }
  if (password.trim() === "") {
    errors.password = "Password can't be empty.";
  }
  const valid = Object.keys(errors).length > 0 ? false : true;
  return {
    valid,
    errors,
  };
};
