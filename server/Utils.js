

function isPathContains(parent,child) {
    let p = parent.split('\\')
    let c = child.split('\\')
    if (c.length < p.length) {
        return false
    }
    for(let i=0;i<p.length;i++) {
        if (p[i] !== c[i]) {
            return false
        }
    }
    return true
}

function findRoots(targets) {
    var targets_  = targets.slice()
    targets_.sort( (a,b) => a.cwd.split('\\').length < b.cwd.split('\\').length ? -1 : 1 )
    var roots = []
    targets_.forEach(target => {
        if (roots.map( root => isPathContains(root, target.cwd) ).filter( e => e != false ).length == 0) {
            roots.push(target.cwd)
        }
    })
    return roots
}

function findTarget(targets,p) {
    var targets_  = targets.slice()
    targets_.sort( (a,b) => a.cwd.split('\\').length < b.cwd.split('\\').length ? 1 : -1 )
    for(var i=0;i<targets_.length;i++) {
        if (isPathContains(targets_[i].cwd,p)) {
            return targets_[i];
        }
    }
}

module.exports = {isPathContains:isPathContains, findRoots:findRoots, findTarget:findTarget}

