# Set variables
$repoUrl = "https://github.com/dennisyd/publishjockey-backend.git"
$bfgJar = "bfg-1.14.0.jar" # Make sure this is in your project root
$replacementsFile = "bfg-replacements.txt"

# 1. Clone the repo as a mirror
git clone --mirror $repoUrl

# 2. Change to the mirror repo directory
Set-Location -Path ".\publishjockey-backend.git"

# 3. Run BFG to delete all .env files
java -jar ..\$bfgJar --delete-files .env

# 4. Run BFG to replace Stripe keys
java -jar ..\$bfgJar --replace-text ..\$replacementsFile

# 5. Clean and prune unreachable objects
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 6. Force push the cleaned history
git push --force

# 7. Return to the original directory
Set-Location ..