// decor.cjs — копирование фона/декора прототипа, удаление слайдов (порт decor.py v3.2.1).
'use strict';
const { deepCopy, findL } = require("./xmlbuild.cjs");
const { El } = require("../xml.cjs");
const { RT } = require("./opc.cjs");

function* iterEl(root) {
  yield root;
  for (const c of root.children) {
    if (c instanceof El) yield* iterEl(c);
  }
}

const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function picMediaName(el, slidePart) {
  const blipFill = findL(el, "blipFill");
  const blip = blipFill ? findL(blipFill, "blip") : null;
  if (!blip) return null;
  const rid = blip.attrs.get(`{${R_NS}}embed`) || blip.attrs.get(`{${R_NS}}link`);
  if (!rid) return null;
  const rel = slidePart.rels.get(rid);
  if (!rel) return null;
  return rel.target.split("/").pop();
}

// slide part → layout part → master part
function layoutMediaNames(pkg, slidePart) {
  const names = new Set();
  const layoutRel = slidePart.rels.findByReltype("slideLayout");
  const parts = [];
  if (layoutRel) {
    const layout = pkg.parts.get(layoutRel.target);
    if (layout) {
      parts.push(layout);
      const masterRel = layout.rels.findByReltype("slideMaster");
      if (masterRel) {
        const master = pkg.parts.get(masterRel.target);
        if (master) parts.push(master);
      }
    }
  }
  for (const part of parts) {
    for (const blip of part.xmlEl.iter()) {
      if (!(blip instanceof El) || blip.local !== "blip") continue;
      const rid = blip.attrs.get(`{${R_NS}}embed`) || blip.attrs.get(`{${R_NS}}link`);
      if (!rid) continue;
      const rel = part.rels.get(rid);
      if (rel) names.add(rel.target.split("/").pop());
    }
  }
  return names;
}

function remapRels(node, srcPart, dstPart) {
  for (const attr of ["embed", "link", "id"]) {
    const rAttr = `{${R_NS}}${attr}`;
    for (const el of iterEl(node)) {
      if (!(el instanceof El) || !el.attrs.has(rAttr)) continue;
      const oldRid = el.attrs.get(rAttr);
      const rel = srcPart.rels.get(oldRid);
      if (!rel) {
        el.attrs.delete(rAttr);
        continue;
      }
      const newRid = rel.isExternal
        ? dstPart.rels.relateTo(rel.reltype, rel.target, true)
        : dstPart.rels.relateTo(rel.reltype, rel.target);
      el.attrs.set(rAttr, newRid);
    }
  }
}

function copyDecor(pkg, protoPart, newPart, mediaClass) {
  const srcCSld = findL(protoPart.xmlEl, "cSld");
  const srcBg = srcCSld ? findL(srcCSld, "bg") : null;
  if (srcBg !== null) {
    const dstCSld = findL(newPart.xmlEl, "cSld");
    removeBg(dstCSld);
    const bgCopy = deepCopy(srcBg);
    remapRels(bgCopy, protoPart, newPart);
    dstCSld.children.splice(0, 0, bgCopy);
  }
  const inherited = layoutMediaNames(pkg, newPart);
  const dstSpTree = findL(findL(newPart.xmlEl, "cSld"), "spTree");
  const srcSpTree = findL(findL(protoPart.xmlEl, "cSld"), "spTree");
  for (const el of srcSpTree.children) {
    if (!(el instanceof El) || el.local !== "pic") continue;
    const name = picMediaName(el, protoPart) || "";
    if (mediaClass[name] !== "background" || inherited.has(name)) continue;
    const node = deepCopy(el);
    remapRels(node, protoPart, newPart);
    dstSpTree.children.splice(2, 0, node);
  }
}

function removeBg(cSld) {
  cSld.children = cSld.children.filter((c) => !(c instanceof El && c.local === "bg"));
}

function deleteSlide(pkg, slidePart) {
  const presPart = pkg.parts.get("/ppt/presentation.xml");
  let rid = null;
  for (const rel of presPart.rels.values()) {
    if (!rel.isExternal && rel.reltype === RT.SLIDE && rel.target === slidePart.partname) {
      rid = rel.rId;
      break;
    }
  }
  const sldIdLst = findLocalDeep(presPart.xmlEl, "sldIdLst");
  for (const sldId of [...sldIdLst.children]) {
    if (sldId instanceof El && sldId.attrs.get(`{${R_NS}}id`) === rid) {
      sldIdLst.children.splice(sldIdLst.children.indexOf(sldId), 1);
      break;
    }
  }
  presPart.rels.dropRel(rid);
}

function findLocalDeep(el, local) {
  for (const n of el.iter()) if (n.local === local) return n;
  return null;
}

module.exports = { copyDecor, deleteSlide, layoutMediaNames, picMediaName, remapRels, removeBg, findLocalDeep };
