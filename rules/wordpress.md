---
paths:
  - "**/wp-content/**"
  - "**/*.php"
  - "**/readme.txt"
  - "**/composer.json"
  - "**/phpunit.xml*"
---

# WordPress plugins

## Packaging a plugin zip
- Build the zip with 7-Zip (`C:\Program Files\7-Zip\7z.exe`), never PowerShell `Compress-Archive`. Compress-Archive writes backslash entries (`vendor\dompdf\...`) that Linux unzips as flat filenames, which breaks every PHP `require`.
- The zip holds one top-level folder named for the plugin's slug on the server, not the local dev folder name. A mismatched name installs a second plugin and leaves the old one active. Read the server slug from asset URLs (`plugins/<slug>/`), copy files into a temp folder with that name, zip it, delete the temp folder:
  ```powershell
  & 'C:\Program Files\7-Zip\7z.exe' a -tzip <slug>.zip <slug> -r
  ```
- Delete and recreate the zip each time; never `7z a` onto an existing one.

## Exclude from production zips
- `config-local.php` (dev keys; production already defines the constants, so it fatals with "Cannot redeclare constant").
- `tests/`, `phpunit.xml`, `test-*.php`, `.git/`, `.gitignore`.
- Dev vendor packages: `vendor/phpunit/`, `vendor/sebastian/`, `vendor/myclabs/`, `vendor/doctrine/`, `vendor/phpdocumentor/`, `vendor/prophecy/`, `vendor/theseer/`, `vendor/phar-io/`.
- Run `composer install --no-dev` before packaging so the Composer autoloaders drop dev references. With no PHP on the machine, filter lines matching those vendor paths out of `autoload_static.php`, `autoload_classmap.php`, `autoload_files.php` (and check `autoload_psr4.php`) with a Node script.

## Uploading
- Check `wp-content/plugins/` is clean (WP File Manager) before uploading. WordPress stores the active plugin as `folder/file.php`; a leftover folder makes the upload land as `<slug>-1`, and activation fails with "Plugin file does not exist".
