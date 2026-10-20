# Setting up Slim

Do these on Slim unless a step says Micky. Type each grey line into Terminal and press Enter.

1. **Open Terminal** (Cmd+Space, type Terminal).

2. **Check the tools are there:**
   ```
   git --version
   node -v
   ```
   - If git asks to install "command line developer tools", click Install and wait.
   - If `node -v` says "command not found", get the LTS installer from nodejs.org and run it.

3. **Make the same folder as on Micky:**
   ```
   mkdir -p ~/Desktop/"1. PROJECTS/Business/AI FILES"
   cd ~/Desktop/"1. PROJECTS/Business/AI FILES"
   ```

4. **Download the project:**
   ```
   git clone https://github.com/guitargaragenz/scheduler.git "GGNZ SCHEDULER PROJECT"
   cd "GGNZ SCHEDULER PROJECT"
   npm install
   ```

5. **Copy the key files from Micky by AirDrop. Never paste them into a chat.**
   - On Micky, open the project folder in Finder and press Cmd+Shift+. to show hidden files.
   - AirDrop `.env` and `.env.local` to Slim.
   - On Slim, move both into the `GGNZ SCHEDULER PROJECT` folder.

6. **Link your personal instructions** so Claude on Slim follows the same rules:
   ```
   mkdir -p ~/.claude
   ln -sf ~/Desktop/"1. PROJECTS/Business/AI FILES/GGNZ SCHEDULER PROJECT/personal-instructions.md" ~/.claude/CLAUDE.md
   ```

7. **Sign in to GitHub** so Slim can save changes back:
   ```
   brew install gh
   gh auth login
   ```
   Pick GitHub.com, then HTTPS, then log in with a browser. (If `brew` isn't found, skip this step
   and ask Claude on Slim to help.)

8. **Test it:**
   ```
   npm run dev
   ```
   Open the link it prints. If the scheduler loads, Slim is done. Press Ctrl+C to stop it.

9. **In the Claude app on Slim:** go to the Code tab and pick the `GGNZ SCHEDULER PROJECT` folder.
   Sessions there are now local to Slim.

**Keep both machines in step:** say "pull main" at the start of a session, so each machine picks up
what the other one changed.
