const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const User = require("../models/User");
require("dotenv").config();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || process.env.clientID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || process.env.clientSecret;
const GITHUB_CALLBACK_URL = process.env.GITHUB_CALLBACK_URL || "/auth/github/callback";

if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
  console.warn("⚠️ Warning: GitHub OAuth client ID/secret not found in env. GitHub login will fail.");
}

passport.use(
  new GitHubStrategy(
    {
      clientID: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      callbackURL: GITHUB_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({
          email: profile.username + "@github.com",
        });
        if (!user) {
          user = await User.create({
            name: profile.displayName || profile.username,
            email: profile.username + "@github.com",
            password: "github", // dummy
          });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});
