import Prism from "prismjs";
import styles from "./deoptMarkers.scss";

/** @type {WeakMap<Node, import('..').V8DeoptInfoWithSources>} */
const deoptData = new WeakMap();

/**
 * @param {Node} element
 * @param {import('..').V8DeoptInfoWithSources} deoptInfo
 */
export function addFileDeoptDataForHighlight(element, deoptInfo) {
	deoptData.set(element, deoptInfo);
}

/**
 * @param {Node} element
 * @param {Node} root
 */
function nextElement(element, root) {
	if (element == root) {
		return null;
	} else if (element.firstChild) {
		return element.firstChild;
	} else if (element.nextSibling) {
		return element.nextSibling;
	} else {
		do {
			element = element.parentNode;
		} while (element && element != root && !element.nextSibling);

		return element ? element.nextSibling : null;
	}
}

/**
 * @param {import('v8-deopt-parser').Entry["type"]} type
 */
function getIcon(type) {
	if (type == "code") {
		return "▲";
	} else if (type == "deopt") {
		return "▼";
	} else {
		return "☎";
	}
}

/**
 * @param {Markers} markers
 * @param {number} curLine
 * @param {number} curColumn
 */
function locHasMarker(markers, curLine, curColumn) {
	const nextMarker = markers[0];
	return (
		markers.length > 0 &&
		curLine == nextMarker.line &&
		curColumn >= nextMarker.column
	);
}

/**
 * @param {import('v8-deopt-parser').Entry} marker
 * @returns {HTMLElement}
 */
function createMarkerElement(marker) {
	const mark = document.createElement("mark");
	mark.textContent = getIcon(marker.type);

	const link = document.createElement("a");
	const classes = [styles.deoptMarker, severityClass(marker.severity)];
	link.className = classes.join(" ");
	link.href = location.hash + `/${marker.line}/${marker.column}`;
	link.appendChild(mark);

	return link;
}

/**
 * @param {Node} element
 * @param {Markers} markers
 * @param {number} curLine
 * @param {number} curColumn
 */
function consumeMarkers(element, markers, curLine, curColumn) {
	let refChild = element;
	while (locHasMarker(markers, curLine, curColumn)) {
		const marker = markers.shift();
		const lastMark = createMarkerElement(marker);

		element.parentNode.insertBefore(lastMark, refChild.nextSibling);
		refChild = lastMark;
	}

	return refChild;
}

const typeOrder = ["code", "deopt", "ics"];

/**
 * @param {Markers} markers
 */
function sortMarkers(markers) {
	return markers.sort((loc1, loc2) => {
		if (loc1.line != loc2.line) {
			return loc1.line - loc2.line;
		} else if (loc1.column != loc2.column) {
			return loc1.column - loc2.column;
		} else if (loc1.type != loc2.type) {
			return typeOrder.indexOf(loc1.type) - typeOrder.indexOf(loc2.type);
		} else {
			return 0;
		}
	});
}

/**
 * @typedef {Array<import('v8-deopt-parser').Entry>} Markers
 * @param {import('..').V8DeoptInfoWithSources} deoptInfo
 * @returns {Markers}
 */
function getMarkers(deoptInfo) {
	return sortMarkers([
		...deoptInfo.codes,
		...deoptInfo.deopts,
		...deoptInfo.ics,
	]);
}

Prism.hooks.add("after-highlight", (env) => {
	const root = env.element;
	const deoptInfo = deoptData.get(root);
	if (!deoptInfo) {
		return;
	}

	const markers = getMarkers(deoptInfo);

	/** @type {Node} */
	let element = root.firstChild;
	let curLine = 1;
	let curColumn = 1;
	while (element) {
		if (element.nodeType == 3 /* TEXT_NODE */) {
			// @ts-ignore
			const text = element.data;

			// Handle of text node contains multiple lines
			// TODO - Inserting markers in the middle of a text node doesn't work
			const lines = text.split("\n");
			for (let i = 0; i < lines.length; i++) {
				if (i > 0) {
					curLine += 1;
					curColumn = 1;
				}

				const line = lines[i];
				curColumn += line.length;

				if (locHasMarker(markers, curLine, curColumn)) {
					const lastMark = consumeMarkers(element, markers, curLine, curColumn);

					element = nextElement(lastMark, root);
				}
			}
		}

		element = nextElement(element, root);
	}
});

function severityClass(severity) {
	if (severity == 1) {
		return styles.sev1;
	} else if (severity == 2) {
		return styles.sev2;
	} else {
		return styles.sev3;
	}
}