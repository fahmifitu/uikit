import { glob } from 'glob';
import NP from 'number-precision';
import { read, write } from './util.js';

NP.enableBoundaryChecking(false);

const themeMixins = {};
const coreMixins = {};
const themeVar = {};
const coreVar = {};

/* template for the new components/mixins.scss file*/
const mixinTemplate = `//
// Component:       Mixin
// Description:     Defines mixins which are used across all components
//
// ========================================================================


// SVG
// ========================================================================

/// Replace \`$search\` with \`$replace\` in \`$string\`
/// @author Hugo Giraudel
/// @param {String} $string - Initial string
/// @param {String} $search - Substring to replace
/// @param {String} $replace ('') - New value
/// @return {String} - Updated string
@function str-replace($string, $search, $replace: '') {
  $index: str-index($string, $search);

  @if $index {
    @return str-slice($string, 1, $index - 1) + $replace + str-replace(str-slice($string, $index + str-length($search)), $search, $replace);
  }

  @return $string;
}

@mixin svg-fill($src, $color-default, $color-new){

    $replace-src: str-replace($src, $color-default, $color-new) !default;
    $replace-src: str-replace($replace-src, "#", "%23");
    background-image: url(quote($replace-src));
}`;

/* template for the inverse components */
const inverseTemplate = `    @include hook-inverse-component-base();
    @include hook-inverse-component-link();
    @include hook-inverse-component-heading();
    @include hook-inverse-component-divider();
    @include hook-inverse-component-list();
    @include hook-inverse-component-icon();
    @include hook-inverse-component-form();
    @include hook-inverse-component-button();
    @include hook-inverse-component-grid();
    @include hook-inverse-component-close();
    @include hook-inverse-component-totop();
    @include hook-inverse-component-badge();
    @include hook-inverse-component-label();
    @include hook-inverse-component-article();
    @include hook-inverse-component-search();
    @include hook-inverse-component-nav();
    @include hook-inverse-component-navbar();
    @include hook-inverse-component-subnav();
    @include hook-inverse-component-breadcrumb();
    @include hook-inverse-component-pagination();
    @include hook-inverse-component-tab();
    @include hook-inverse-component-slidenav();
    @include hook-inverse-component-dotnav();
    @include hook-inverse-component-accordion();
    @include hook-inverse-component-iconnav();
    @include hook-inverse-component-text();
    @include hook-inverse-component-column();
    @include hook-inverse-component-utility();`;

/* First Step: Go through all files */
for (const file of (await glob('src/less/**/*.less')).sort()) {
    const data = await read(file);

    /* replace all Less stuff with SCSS */
    let scssData = data
        .replace(/\/less\//g, '/scss/') // change less/ dir to scss/ on imports
        .replace(/\.less/g, '.scss') // change .less extensions to .scss on imports
        .replace(/@/g, '$') // convert variables
        .replace(
            /(:[^'"]*?\([^'"]+?)\s*\/\s*([0-9.-]+)\)/g,
            (exp, m1, m2) => `${m1} * ${NP.round(1 / parseFloat(m2), 5)})`
        )
        .replace(/--uk-[^\s]+: (\$[^\s]+);/g, (exp, name) => exp.replace(name, `#{${name}}`))
        .replace(/\\\$/g, '\\@') // revert classes using the @ symbol
        .replace(/ e\(/g, ' unquote(') // convert escape function
        .replace(/\.([\w-]*)\s*\((.*)\)\s*{/g, '@mixin $1($2){') // hook -> mixins
        .replace(/(\$[\w-]*)\s*:(.*);/g, '$1: $2 !default;') // make variables optional
        .replace(/@mixin ([\w-]*)\s*\((.*)\)\s*{\s*}/g, '// @mixin $1($2){}') // comment empty mixins
        .replace(/\.(hook[a-zA-Z\-\d]+)(\(\))?;/g, '@if(mixin-exists($1)) {@include $1();}') // hook calls surrounded by a mixin-exists
        .replace(/\$(import|supports|media|font-face|page|keyframes|-moz-document)/g, '@$1') // replace valid '@' statements
        .replace(/tint\((\$[\w-]+),\s([^)]*)\)/g, 'mix(white, $1, $2)') // replace Less function tint with mix
        .replace(/fade\((\$[\w-]*), ([0-9]+)%\)/g, (match, p1, p2) => {
            return `rgba(${p1}, ${p2 / 100})`;
        }) // replace Less function fade with rgba
        .replace(/fade(in|out)\((\$[\w-]*), ([0-9]+)%\)/g, (match, p1, p2, p3) => {
            return `fade-${p1}(${p2}, ${p3 / 100})`;
        }) // replace Less function fadeout with fade-out
        .replace(/\.svg-fill/g, '@include svg-fill') // include svg-fill mixin
        .replace(
            /(.*):extend\((\.[\w\\@-]*) all\) when \((\$[\w-]*) = ([\w]+)\) {}/g,
            '@if ( $3 == $4 ) { $1 { @extend $2 !optional;} }'
        ) // update conditional extend and add !optional to ignore warnings
        .replace(
            /(\.[\w\\@-]+)\s*when\s*\((\$[\w-]*)\s*=\s*(\w+)\)\s*{\s*@if\(mixin-exists\(([\w-]*)\)\) {@include\s([\w-]*)\(\);\s*}\s*}/g,
            '@if ($2 == $3) { $1 { @if (mixin-exists($4)) {@include $4();}}}'
        ) // update conditional hook
        .replace(
            /([.:][\w\\@-]+(?: ?[.:][\w\\@-]+)*)\s*when\s*\(([$@][\w-]*)\s*=\s*([$@]?[\w-]+)\)\s*({\s*.*?\s*})/gms,
            '@if ($2 == $3) {\n$1 $4\n}'
        )
        .replace(
            /([.:][\w\\@-]+(?: ?[.:][\w\\@-]+)*)\s*when\s+not\s*\(([$@][\w-]*)\s*=\s*([$@]?[\w-]+)\)\s*({\s*.*?\s*})/gs,
            '@if ($2 != $3) {\n$1 $4\n}'
        ) // replace conditionals
        .replace(/\${/g, '#{$') // string literals: from: /~"(.*)"/g, to: '#{"$1"}'
        .replace(/[^(](-\$[\w-]*)/g, ' ($1)') // surround negative variables with brackets
        .replace(/(--[\w-]+:\s*)~'([^']+)'/g, '$1$2') // string literals in custom properties
        .replace(/~('[^']+')/g, 'unquote($1)'); // string literals: for real

    /* File name of the current file */
    const [filename] = file.split('/').pop().split('.less');

    if (filename !== 'inverse') {
        scssData = scssData.replace(/hook-inverse(?!-)/g, `hook-inverse-component-${filename}`);
    } else {
        const joinedHook = `@mixin hook-inverse(){\n${inverseTemplate}\n}\n`;
        scssData = scssData.replace(/\*\//, '*/\n' + joinedHook);
    }

    /* get all the mixins and remove them from the file */
    scssData = getMixinsFromFile(file, scssData);

    /* get all Variables and remove them */
    scssData = await getVariablesFromFile(file, scssData);

    if (filename === 'uikit.theme') {
        /* remove the theme import first place */
        scssData = scssData.replace(/\/\/\n\/\/ Theme\n\/\/\n\n@import "theme\/_import.scss";/, '');
        /* add uikit-mixins and uikit-variables include to the uikit.scss file and change order, to load theme files first */
        scssData = scssData.replace(
            /\/\/ Core\n\/\//g,
            '// Theme\n//\n\n@import "theme/_import.scss";'
        );
    }

    /* mixin.less needs to be fully replaced by the new mixin file*/
    if (filename === 'mixin') {
        scssData = mixinTemplate;
    }

    await write(file.replace(/less/g, 'scss').replace('.theme.', '-theme.'), scssData);
}

/* Second Step write all new needed files for SASS */

/* write mixins into new file */
delete themeMixins['svg-fill'];
const mixins_theme = Object.keys(themeMixins).map(function (key) {
    return themeMixins[key];
});
await write('src/scss/mixins-theme.scss', mixins_theme.join('\n'));

delete coreMixins['svg-fill'];
const mixins_core = Object.keys(coreMixins).map(function (key) {
    return coreMixins[key];
});
await write('src/scss/mixins.scss', mixins_core.join('\n'));

/* write core variables */
const compactCoreVar = new Set();
Object.keys(coreVar).map((key) =>
    getAllDependencies(coreVar, key).forEach((dependency) => compactCoreVar.add(dependency))
);

await write('src/scss/variables.scss', Array.from(compactCoreVar).join('\n'));

/* write theme variables */
const compactThemeVar = new Set();
Object.keys(themeVar).map((key) =>
    getAllDependencies(themeVar, key).forEach((dependency) => compactThemeVar.add(dependency))
);

await write('src/scss/variables-theme.scss', Array.from(compactThemeVar).join('\n'));

/*
 * recursive function to get a dependencie Set which is ordered so that no depencies exist to a later on entry
 * @return Set with all the dependencies.
 */
function getAllDependencies(allVariables, currentKey, dependencies = new Set()) {
    allVariables[currentKey].dependencies?.forEach((dependency) =>
        getAllDependencies(allVariables, dependency, dependencies).forEach((newDependency) =>
            dependencies.add(newDependency)
        )
    );

    dependencies.add(`${currentKey}: ${allVariables[currentKey].value}`);
    return Array.from(dependencies);
}

/*
 * function to extract all the mixins from a given file with its data.
 * @return an updated data where the mixins have been removed.
 */
function getMixinsFromFile(file, data) {
    /* Step 1: get all includes and insert them, so that at least empty mixins exist. */
    let regex = /@include ([a-z0-9-]+)/g;
    let match = regex.exec(data);

    while (match) {
        if (!(match[1] in themeMixins)) {
            themeMixins[match[1]] = `@mixin ${match[1]}(){}`;
        }
        if (!(match[1] in coreMixins)) {
            coreMixins[match[1]] = `@mixin ${match[1]}(){}`;
        }

        match = regex.exec(data);
    }

    /* Step 2: get all multiline mixins */
    regex = /@mixin ([\w-]*)\s*\((.*)\)\s*{\n(\s+[\w\W]+?)(?=\n})\n}/g;
    match = regex.exec(data);

    while (match) {
        [themeMixins[match[1]]] = match;
        if (!file.includes('theme/')) {
            [coreMixins[match[1]]] = match;
        }
        match = regex.exec(data);
    }

    /* Step 3: get all single line mixins */
    regex = /@mixin ([\w-]*)\s*\((.*)\)\s*{( [^\n]+)}/g;
    match = regex.exec(data);

    while (match) {
        [themeMixins[match[1]]] = match;
        if (!file.includes('theme/')) {
            [coreMixins[match[1]]] = match;
        }

        match = regex.exec(data);
    }

    /* Step 4: remove the mixins from the file, so that users can overwrite them in their custom code. */
    return data
        .replace(/@mixin ([\w-]*)\s*\((.*)\)\s*{\n(\s+[\w\W]+?)(?=\n})\n}/g, '')
        .replace(/@mixin ([\w-]*)\s*\((.*)\)\s*{( [^\n]+)}/g, '');
}

/*
 * function to extract all the variables from a given file with its data.
 * @return an updated data where the icons have been replaced by the actual SVG data.
 */
async function getVariablesFromFile(file, data) {
    const regex = /(\$[\w-]*)\s*:\s*(.*);/g;
    let match = regex.exec(data);

    while (match) {
        /* check if variable is a background icon, if so replace it directly by the SVG */
        if (match[0].includes('../../images/backgrounds')) {
            const iconregex =
                /(\$[\w-]+)\s*:\s*"\.\.\/\.\.\/images\/backgrounds\/([\w./-]+)" !default;/g;
            const iconmatch = iconregex.exec(match[0]);
            let svg = (await read(`src/images/backgrounds/${iconmatch[2]}`)).toString();
            svg = `"${svg
                .replace(/\r?\n|\r/g, '%0A')
                .replace(/"/g, "'")
                .replace(/\s/g, '%20')
                .replace(/</g, '%3C')
                .replace(/=/g, '%3D')
                .replace(/'/g, '%22')
                .replace(/:/g, '%3A')
                .replace(/\//g, '%2F')
                .replace(/>/g, '%3E')
                .replace(/%3Csvg/, 'data:image/svg+xml;charset=UTF-8,%3Csvg')}"`;

            /* add SVG to the coreVar and themeVar only if it is a theme file and make it optional */
            if (!file.includes('theme/')) {
                coreVar[iconmatch[1]] = { value: `${svg} !default;`, dependencies: [] };
            }

            themeVar[iconmatch[1]] = { value: `${svg} !default;`, dependencies: [] };

            /* add SVG to the variable within the file itself as well */
            const inlineSVG = `${iconmatch[1]}: ${svg} !default;`;
            data = data.replace(match[0], inlineSVG);

            /* when it is not an SVG add the variable and search for its dependencies */
        } else {
            const variablesRegex = /(\$[\w-]+)/g;
            let variablesMatch = variablesRegex.exec(match[2]);
            const dependencies = [];

            while (variablesMatch) {
                dependencies.push(variablesMatch[1]);
                variablesMatch = variablesRegex.exec(match[2]);
            }

            /* add variables only to the core Variables if it is not a theme file */
            if (!file.includes('theme/')) {
                coreVar[match[1]] = {
                    value: `${match[2]};`,
                    dependencies: Array.from(dependencies),
                };
            }

            themeVar[match[1]] = { value: `${match[2]};`, dependencies: Array.from(dependencies) };
        }

        match = regex.exec(data);
    }

    return data.replace(/(\$[\w-]*)\s*:(.*);\r?\n/g, '// $&');
}
