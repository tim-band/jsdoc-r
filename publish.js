const doop = require('jsdoc/util/doop');
const env = require('jsdoc/env');
const fs = require('jsdoc/fs');
const helper = require('jsdoc/util/templateHelper');
const logger = require('jsdoc/util/logger');
const path = require('jsdoc/path');
const taffy = require('taffydb').taffy;
const template = require('jsdoc/template');
const util = require('util');

const htmlsafe = helper.htmlsafe;
const linkto = helper.linkto;
const resolveAuthorLinks = helper.resolveAuthorLinks;

let data;
let view;

let outdir = path.normalize(env.opts.destination);

function hashToLink(doclet, hash) {
    let url;

    if ( !/^(#.+)/.test(hash) ) {
        return hash;
    }

    url = helper.createLink(doclet);
    url = url.replace(/(#.+|$)/, hash);

    return `<a href="${url}">${hash}</a>`;
}

function needsSignature({kind, type, meta}) {
    let needsSig = false;

    // function and class definitions always get a signature
    if (kind === 'function' || kind === 'class') {
        needsSig = true;
    }
    // typedefs that contain functions get a signature, too
    else if (kind === 'typedef' && type && type.names &&
        type.names.length) {
        for (let i = 0, l = type.names.length; i < l; i++) {
            if (type.names[i].toLowerCase() === 'function') {
                needsSig = true;
                break;
            }
        }
    }
    // and namespaces that are functions get a signature (but finding them is a
    // bit messy)
    else if (kind === 'namespace' && meta && meta.code &&
        meta.code.type && meta.code.type.match(/[Ff]unction/)) {
        needsSig = true;
    }

    return needsSig;
}

function getPathFromDoclet({meta}) {
    if (!meta) {
        return null;
    }

    return meta.path && meta.path !== 'null' ?
        path.join(meta.path, meta.filename) :
        meta.filename;
}

/**
    @param {TAFFY} taffyData See <http://taffydb.com/>.
    @param {object} opts
    @param {Tutorial} tutorials
 */
exports.publish = (taffyData, opts, tutorials) => {
    let classes;
    let conf;
    let externals;
    let files;
    let fromDir;
    let globalUrl;
    let indexUrl;
    let interfaces;
    let members;
    let mixins;
    let modules;
    let namespaces;
    let outputSourceFiles;
    let packageInfo;
    let packages;
    const sourceFilePaths = [];
    let sourceFiles = {};
    let staticFileFilter;
    let staticFilePaths;
    let staticFiles;
    let staticFileScanner;
    let templatePath;

    data = taffyData;

    conf = env.conf.templates || {};
    conf.default = conf.default || {};

    templatePath = path.normalize(opts.template);
    view = new template.Template( path.join(templatePath, 'tmpl') );

    // claim some special filenames in advance, so the All-Powerful Overseer of Filename Uniqueness
    // doesn't try to hand them out later
    indexUrl = helper.getUniqueFilename('index');
    // don't call registerLink() on this one! 'index' is also a valid longname

    globalUrl = helper.getUniqueFilename('global');
    helper.registerLink('global', globalUrl);

    // set up templating
    // view.layout = conf.default.layoutFile ?
    //     path.getResourcePath(path.dirname(conf.default.layoutFile),
    //         path.basename(conf.default.layoutFile) ) :
    //     'layout.tmpl';

    // set up tutorials for helper
    helper.setTutorials(tutorials);

    data = helper.prune(data);
    data.sort('longname, version, since');
    helper.addEventListeners(data);

    fs.mkPath(outdir);
    data().each(doclet => {
        console.log('DOCLET:', doclet.kind, doclet.name, doclet.longname);
        if (typeof(doclet.meta) === 'object') {
            console.log('path, filename:', doclet.meta.filename, doclet.meta.path);
        } else {
            console.log('[no metadata]');
        }
        console.log('vars, scope:', doclet.vars, doclet.scope);
        console.log(doclet.description);
        for (let i in doclet.params) {
            const p = doclet.params[i];
            console.log('Param:', p.name, p.type, p.description);
        }
        for (let i in doclet.properties) {
            const p = doclet.properties[i];
            console.log('Param:', p.name, p.type, p.description);
        }
        if (doclet.kind !== 'package') {
            let title = doclet.name;
            let description = doclet.description;
            const paragraphs = description.split(/(?:\n|\r|\r\n){2}/);
            if (1 < paragraphs.length) {
                title = paragraphs.shift();
                description = paragraphs.join('\n\n');
            }
            const rd = view.render('rd.tmpl', {
                title: title,
                filename: doclet.meta.filename,
                name: doclet.longname,
                description: description,
                params: typeof(doclet.params) !== 'object'? [] : doclet.params,
                properties: doclet.properties,
            });
            const outpath = path.join(outdir, doclet.name + '.Rd');
            console.log('outpath:', outpath);
            fs.writeFileSync(outpath, rd, 'utf8');
            console.log(rd);
        }
        let sourcePath;

        doclet.attribs = '';

        if (doclet.examples) {
            doclet.examples = doclet.examples.map(example => {
                let caption;
                let code;

                if (example.match(/^\s*<caption>([\s\S]+?)<\/caption>(\s*[\n\r])([\s\S]+)$/i)) {
                    caption = RegExp.$1;
                    code = RegExp.$3;
                }

                return {
                    caption: caption || '',
                    code: code || example
                };
            });
        }
        if (doclet.see) {
            doclet.see.forEach((seeItem, i) => {
                doclet.see[i] = hashToLink(doclet, seeItem);
            });
        }

        // build a list of source files
        if (doclet.meta) {
            sourcePath = getPathFromDoclet(doclet);
            sourceFiles[sourcePath] = {
                resolved: sourcePath,
                shortened: null
            };
            if (!sourceFilePaths.includes(sourcePath)) {
                sourceFilePaths.push(sourcePath);
            }
        }
    });
};
