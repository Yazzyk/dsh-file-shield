window.__ModuleLoader__.load({ id: "dsh-file-shield", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_dsh_client_ui_primitives5 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/page.css
var page_default = "/*\n * File Shield \u9875\u9762\u6837\u5F0F\u3002\u7C7B\u540D\u5E26\u524D\u7F00\uFF0C\u56E0\u4E3A\u672C\u63D2\u4EF6\u4E0D\u5728 shell \u7684 CSS Modules\n * \u7BA1\u7EBF\u5185\uFF1B\u989C\u8272\u53D6\u81EA\u4E3B\u9898\u7684\u8BED\u4E49 token\uFF0C\n * \u9875\u9762\u56E0\u6B64\u8DDF\u968F\u6D45\u8272\u4E0E\u6DF1\u8272\u6A21\u5F0F\u3002\n */\n\n.dfs-page {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  font-size: 13px;\n  color: var(--dsw-alias-label-primary, inherit);\n}\n\n.dfs-head {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.dfs-heading {\n  margin: 0;\n  font-size: 13px;\n  font-weight: 600;\n}\n\n.dfs-note {\n  margin: 0;\n  color: var(--dsw-alias-label-caption, inherit);\n}\n\n.dfs-note-error {\n  color: var(--dsw-alias-label-error, inherit);\n}\n\n.dfs-rules {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  margin: 0;\n  padding: 0;\n  list-style: none;\n}\n\n.dfs-rule {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 4px 8px;\n  border: 1px solid var(--dsw-alias-border-l2, transparent);\n  border-radius: 8px;\n}\n\n.dfs-rule .dfs-path {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dfs-path {\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-size: 12px;\n}\n\n.dfs-actions {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.dfs-actions > :first-child {\n  flex: 1;\n  min-width: 0;\n}\n\n/* \u53EA\u653E\u6309\u94AE\u7684\u4E00\u884C\u4E0D\u62C9\u5BBD\u7B2C\u4E00\u4E2A\u6309\u94AE\uFF1A\u8FD9\u91CC\u6CA1\u6709\u9700\u8981\u5360\u6EE1\u5BBD\u5EA6\u7684\u8F93\u5165\u6846\u3002 */\n.dfs-buttons {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n}\n\n.dfs-foot {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  margin-top: 4px;\n}\n\n.dfs-status {\n  color: var(--dsw-alias-label-caption, inherit);\n}\n\n.dfs-browser {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  max-height: 45vh;\n  overflow-y: auto;\n}\n\n.dfs-crumbs {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.dfs-crumbs .dfs-path {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dfs-list {\n  display: flex;\n  flex-direction: column;\n  gap: 1px;\n  margin: 0;\n  padding: 0;\n  list-style: none;\n}\n\n.dfs-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  width: 100%;\n  padding: 5px 8px;\n  border: 0;\n  border-radius: 6px;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n\n.dfs-row:hover:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-hover, transparent);\n}\n\n.dfs-row:disabled {\n  cursor: default;\n  color: var(--dsw-alias-label-dimmed, inherit);\n}\n\n.dfs-rowName {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dfs-tag {\n  color: var(--dsw-alias-label-caption, inherit);\n  font-size: 11px;\n}\n/* ---- \u5DE6\u4FA7\u9762\u677F\uFF1A\u4E09\u7EA7\u914D\u7F6E\u7A97\u53E3 ---- */\n\n/*\n * \u4E3B\u533A\u5EA7\u4F4D\u81EA\u5DF1\u6491\u6EE1\u5E76\u6EDA\u52A8\uFF1A\u5B98\u65B9\u9875\u9762\u4E5F\u662F\u8FD9\u4E48\u505A\u7684\uFF08\u7236\u7EA7\u4E0D\u63D0\u4F9B\u6EDA\u52A8\u5BB9\u5668\uFF09\uFF0C\n * \u5426\u5219\u957F\u5217\u8868\u4F1A\u9876\u51FA\u9762\u677F\u4E4B\u5916\u3002\n */\n.dfs-panel {\n  box-sizing: border-box;\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  height: 100%;\n  padding: 16px clamp(16px, 3vw, 28px) 32px;\n  font-size: 13px;\n  color: var(--dsw-alias-label-primary, inherit);\n  overflow-y: auto;\n}\n\n/* \u5185\u5BB9\u5217\u5BBD\u4E0A\u9650\uFF0C\u5BBD\u5C4F\u4E0B\u4E0D\u628A\u89C4\u5219\u884C\u62C9\u6210\u4E00\u6574\u6761\u3002 */\n.dfs-panel > * {\n  width: 100%;\n  max-width: 880px;\n}\n\n.dfs-panelHead {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  color: var(--dsw-alias-label-secondary, inherit);\n}\n\n.dfs-panelTitle {\n  margin: 0;\n  font-size: 15px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-primary, inherit);\n}\n\n/* \u4E00\u7EA7\u89C4\u5219\u6BB5\uFF1A\u5E95\u8272\u5206\u5C42\u800C\u4E0D\u662F\u753B\u91CD\u8FB9\u6846\uFF0C\u6DF1\u6D45\u8272\u90FD\u8DDF\u7740\u4E3B\u9898\u8D70\u3002 */\n.dfs-level {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  padding: 12px;\n  border: 1px solid var(--dsw-alias-border-l2, transparent);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-1, transparent);\n}\n\n.dfs-levelRow {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  padding: 8px;\n  border: 1px solid var(--dsw-alias-border-l2, transparent);\n  border-radius: 8px;\n}\n\n.dfs-row-static {\n  cursor: default;\n}\n\n.dfs-editor {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n/* \u9879\u76EE / \u4F1A\u8BDD\u884C\u91CC\u7684\u8DEF\u5F84\u8981\u5403\u6389\u5269\u4F59\u5BBD\u5EA6\uFF0C\u6309\u94AE\u624D\u4E0D\u4F1A\u88AB\u6324\u8D70\u3002 */\n.dfs-path-grow {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dfs-hint {\n  color: var(--dsw-alias-label-caption, inherit);\n  font-size: 11px;\n}\n\n/* ---- \u4F1A\u8BDD\u5934\u90E8\u76FE\u724C\u6309\u94AE\u7684\u5BF9\u8BDD\u6846 ---- */\n\n.dfs-dialogBody {\n  max-height: 55vh;\n  overflow-y: auto;\n}\n\n.dfs-dialog {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  font-size: 13px;\n  color: var(--dsw-alias-label-primary, inherit);\n}\n";

// src/client/Page.tsx
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_react2 = require("react");

// src/client/Browser.tsx
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var import_react = require("react");

// src/client/api.ts
var BROWSE_ENDPOINT = "/file-shield/browse";
var BrowseError = class extends Error {
  /**
   * @param code - 宿主的失败码；响应不是 JSON 时为 `invalid-response`。
   * @param message - 诊断消息。
   */
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "BrowseError";
  }
};
async function browse(path, signal) {
  const query = path === void 0 ? "" : `?path=${encodeURIComponent(path)}`;
  const response = await fetch(`${BROWSE_ENDPOINT}${query}`, {
    signal,
    credentials: "same-origin",
    headers: { accept: "application/json" }
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new BrowseError("invalid-response", `the browse route answered ${response.status} without JSON`);
  }
  if (!response.ok) {
    const error = payload?.error;
    throw new BrowseError(
      typeof error?.code === "string" ? error.code : "unknown",
      typeof error?.message === "string" ? error.message : `the browse route answered ${response.status}`
    );
  }
  return payload;
}

// src/client/Browser.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function DirectoryBrowser({ t, onCancel, onPickFile, onPickDirectory }) {
  const [path, setPath] = (0, import_react.useState)(void 0);
  const [listing, setListing] = (0, import_react.useState)(void 0);
  const [failure, setFailure] = (0, import_react.useState)(void 0);
  const [loading, setLoading] = (0, import_react.useState)(true);
  (0, import_react.useEffect)(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailure(void 0);
    browse(path, controller.signal).then((result) => {
      setListing(result);
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setFailure(error instanceof BrowseError ? error : new BrowseError("unknown", String(error)));
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => {
      controller.abort();
    };
  }, [path]);
  const entries = listing?.entries ?? [];
  const current = listing?.path;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_dsh_client_ui_primitives.Modal,
    {
      open: true,
      onClose: onCancel,
      closeLabel: t("cancel"),
      title: t("browseTitle"),
      description: current ?? "",
      footer: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", onClick: onCancel, children: t("cancel") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          import_dsh_client_ui_primitives.Button,
          {
            variant: "primary",
            disabled: current === void 0,
            onClick: () => {
              if (current !== void 0) onPickDirectory(current);
            },
            children: t("browseChooseDirectory")
          }
        )
      ] }),
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dfs-browser", children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dfs-crumbs", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            import_dsh_client_ui_primitives.Button,
            {
              size: "sm",
              variant: "outline",
              disabled: listing?.parent === null || listing === void 0,
              onClick: () => {
                setPath(listing?.parent ?? void 0);
              },
              children: t("browseUp")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { className: "dfs-path", children: current ?? "" })
        ] }),
        loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dfs-note", children: t("loading") }) : null,
        failure === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "dfs-note dfs-note-error", children: [
          t("browseFailed"),
          " \u2014 ",
          failure.code
        ] }),
        !loading && failure === void 0 && entries.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dfs-note", children: t("browseEmpty") }) : null,
        listing?.truncated === true ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dfs-note", children: t("browseTruncated") }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { className: "dfs-list", children: entries.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "button",
          {
            type: "button",
            className: "dfs-row",
            disabled: entry.type === "other",
            onClick: () => {
              const next = current === void 0 ? entry.name : `${current}/${entry.name}`;
              if (entry.type === "directory") setPath(next);
              else onPickFile(next);
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dfs-rowName", children: entry.type === "directory" ? `${entry.name}/` : entry.name }),
              entry.symlink ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dfs-tag", children: "link" }) : null
            ]
          }
        ) }, entry.name)) })
      ] })
    }
  );
}

// src/client/Page.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function sameRules(left, right) {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}
function isPattern(rule) {
  return /[*?[\]{}]/u.test(rule);
}
function FileShieldPage(props) {
  if (props.form === void 0) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dfs-note", children: props.t("unavailable") });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RulesEditor, { ...props, form: props.form });
}
function RulesEditor(props) {
  const { t, view, form, pickDirectory } = props;
  const subscribe = (0, import_react2.useMemo)(() => (listener) => form.subscribe(listener), [form]);
  const snapshot = (0, import_react2.useSyncExternalStore)(subscribe, () => form.getSnapshot(), () => form.getSnapshot());
  const [staged, setStaged] = (0, import_react2.useState)(null);
  const [browsing, setBrowsing] = (0, import_react2.useState)(false);
  const [manual, setManual] = (0, import_react2.useState)("");
  const [status, setStatus] = (0, import_react2.useState)("idle");
  const stored = snapshot.value?.deny ?? [];
  const rules = staged ?? stored;
  const userLayer = snapshot.user;
  const overridden = typeof userLayer === "object" && userLayer !== null && "deny" in userLayer;
  if (view === "summary") {
    return rules.length === 0 ? t("summaryNone") : t("summaryCount", { count: rules.length });
  }
  if (snapshot.status === "unavailable") return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dfs-note", children: t("unavailable") });
  if (snapshot.status === "loading") return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dfs-note", children: t("loading") });
  const writable = snapshot.writable;
  const update = (next) => {
    setStaged(next);
    setStatus("idle");
  };
  const add = (candidate) => {
    const rule = candidate.trim();
    if (rule === "" || rules.includes(rule)) return;
    update([...rules, rule]);
  };
  const submitManual = () => {
    add(manual);
    setManual("");
  };
  const save = async () => {
    if (staged === null) return;
    setStatus("saving");
    await form.set("deny", staged);
    const accepted = form.getSnapshot().value?.deny;
    if (accepted !== void 0 && sameRules(accepted, staged)) {
      setStaged(null);
      setStatus("saved");
    } else {
      setStatus("failed");
    }
  };
  const reset = async () => {
    setStatus("saving");
    await form.unset("deny");
    const layer = form.getSnapshot().user;
    if (typeof layer !== "object" || layer === null || !("deny" in layer)) {
      setStaged(null);
      setStatus("saved");
    } else {
      setStatus("failed");
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dfs-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dfs-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("h4", { className: "dfs-heading", children: t("rulesHeading") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Tag, { tone: "neutral", children: overridden ? t("overridden") : t("usingDefault") })
    ] }),
    rules.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "dfs-note", children: t("emptyRules") }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "dfs-rules", children: rules.map((rule) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { className: "dfs-rule", children: [
      isPattern(rule) ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Tag, { tone: "neutral", children: t("kindPattern") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("code", { className: "dfs-path", children: rule }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        import_dsh_client_ui_primitives2.Button,
        {
          size: "sm",
          variant: "ghost",
          disabled: !writable,
          onClick: () => {
            update(rules.filter((entry) => entry !== rule));
          },
          children: t("remove")
        }
      )
    ] }, rule)) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dfs-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", disabled: !writable, onClick: () => {
        setBrowsing(true);
      }, children: t("addFile") }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        import_dsh_client_ui_primitives2.Button,
        {
          variant: "outline",
          disabled: !writable || pickDirectory === void 0,
          onClick: () => {
            void pickDirectory?.().then((picked) => {
              if (typeof picked === "string") add(picked);
            });
          },
          children: t("addSystemDirectory")
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dfs-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        import_dsh_client_ui_primitives2.Input,
        {
          value: manual,
          placeholder: t("manualPlaceholder"),
          disabled: !writable,
          onChange: (event) => {
            setManual(event.currentTarget.value);
          },
          onKeyDown: (event) => {
            if (event.key !== "Enter") return;
            submitManual();
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "outline", disabled: !writable || manual.trim() === "", onClick: submitManual, children: t("manualAdd") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dfs-foot", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "dfs-status", children: !writable ? t("readOnly") : status === "saving" ? t("saving") : status === "saved" ? t("saved") : status === "failed" ? t("saveFailed") : "" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "dfs-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "ghost", disabled: !writable || !overridden, onClick: () => {
          void reset();
        }, children: t("reset") }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives2.Button, { variant: "primary", disabled: !writable || staged === null, onClick: () => {
          void save();
        }, children: t("save") })
      ] })
    ] }),
    browsing ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      DirectoryBrowser,
      {
        t,
        onCancel: () => {
          setBrowsing(false);
        },
        onPickFile: (path) => {
          add(path);
          setBrowsing(false);
        },
        onPickDirectory: (path) => {
          add(path);
          setBrowsing(false);
        }
      }
    ) : null
  ] });
}

// src/client/LevelsPanel.tsx
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_react3 = require("react");

// src/client/state.ts
var STATE_ENDPOINT = "/file-shield/state";
var SESSION_ENDPOINT = "/file-shield/session";
var StateError = class extends Error {
  /**
   * @param code - 宿主的失败码（invalid-body / invalid-scope / not-absolute / …）；
   *   响应不是 JSON 时为 `invalid-response`。
   * @param message - 诊断消息。
   */
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "StateError";
  }
};
function ruleList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry) => typeof entry === "string");
}
function ruleMap(value) {
  if (typeof value !== "object" || value === null) return {};
  const table = {};
  for (const [key, list] of Object.entries(value)) table[key] = ruleList(list);
  return table;
}
function workspaceList(value) {
  if (!Array.isArray(value)) return [];
  const list = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry;
    if (typeof record.path !== "string" || record.path === "") continue;
    list.push({
      id: typeof record.id === "string" ? record.id : record.path,
      path: record.path,
      title: typeof record.title === "string" && record.title !== "" ? record.title : record.path,
      sessions: typeof record.sessions === "number" ? record.sessions : 0
    });
  }
  return list;
}
function toState(payload) {
  const root = typeof payload === "object" && payload !== null ? payload : {};
  const levels = typeof root.levels === "object" && root.levels !== null ? root.levels : {};
  return {
    levels: {
      global: ruleList(levels.global),
      projects: ruleMap(levels.projects),
      sessions: ruleMap(levels.sessions)
    },
    deployment: ruleList(root.deployment),
    workspaces: workspaceList(root.workspaces)
  };
}
async function request(url, init) {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { accept: "application/json" },
    ...init
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new StateError("invalid-response", `the state route answered ${response.status} without JSON`);
  }
  if (!response.ok) {
    const error = payload?.error;
    throw new StateError(
      typeof error?.code === "string" ? error.code : "unknown",
      typeof error?.message === "string" ? error.message : `the state route answered ${response.status}`
    );
  }
  return payload;
}
async function readState(signal) {
  return toState(await request(STATE_ENDPOINT, { signal }));
}
async function writeState(body, signal) {
  return toState(await request(STATE_ENDPOINT, {
    method: "POST",
    signal,
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body)
  }));
}
async function readSessionCwd(session, signal) {
  const payload = await request(`${SESSION_ENDPOINT}?session=${encodeURIComponent(session)}`, { signal });
  const cwd = payload?.cwd;
  return typeof cwd === "string" ? cwd : null;
}

// src/client/LevelsPanel.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function isPattern2(rule) {
  return /[*?[\]{}]/u.test(rule);
}
function RuleEditor({ t, rules, writable, onSave }) {
  const [staged, setStaged] = (0, import_react3.useState)(null);
  const [browsing, setBrowsing] = (0, import_react3.useState)(false);
  const [manual, setManual] = (0, import_react3.useState)("");
  const [status, setStatus] = (0, import_react3.useState)("idle");
  const [failure, setFailure] = (0, import_react3.useState)(void 0);
  const current = staged ?? [...rules];
  const update = (next) => {
    setStaged(next);
    setStatus("idle");
    setFailure(void 0);
  };
  const add = (candidate) => {
    const rule = candidate.trim();
    if (rule === "" || current.includes(rule)) return;
    update([...current, rule]);
  };
  const submitManual = () => {
    add(manual);
    setManual("");
  };
  const save = async () => {
    if (staged === null) return;
    setStatus("saving");
    setFailure(void 0);
    const code = await onSave(staged);
    if (code === void 0) {
      setStaged(null);
      setStatus("saved");
    } else {
      setFailure(code);
      setStatus("failed");
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dfs-editor", children: [
    current.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dfs-note", children: t("emptyRules") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { className: "dfs-rules", children: current.map((rule) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("li", { className: "dfs-rule", children: [
      isPattern2(rule) ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Tag, { tone: "neutral", children: t("kindPattern") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("code", { className: "dfs-path", children: rule }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        import_dsh_client_ui_primitives3.Button,
        {
          size: "sm",
          variant: "ghost",
          disabled: !writable,
          onClick: () => {
            update(current.filter((entry) => entry !== rule));
          },
          children: t("remove")
        }
      )
    ] }, rule)) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dfs-buttons", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "outline", disabled: !writable, onClick: () => {
      setBrowsing(true);
    }, children: t("addFile") }) }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dfs-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        import_dsh_client_ui_primitives3.Input,
        {
          value: manual,
          placeholder: t("manualPlaceholder"),
          disabled: !writable,
          onChange: (event) => {
            setManual(event.currentTarget.value);
          },
          onKeyDown: (event) => {
            if (event.key !== "Enter") return;
            submitManual();
          }
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "outline", disabled: !writable || manual.trim() === "", onClick: submitManual, children: t("manualAdd") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dfs-foot", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dfs-status", children: !writable ? t("readOnly") : status === "saving" ? t("saving") : status === "saved" ? t("saved") : status === "failed" ? `${t("saveFailed")} \u2014 ${failure ?? "unknown"}` : "" }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dfs-buttons", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          import_dsh_client_ui_primitives3.Button,
          {
            variant: "ghost",
            disabled: !writable || staged === null,
            onClick: () => {
              setStaged(null);
              setStatus("idle");
              setFailure(void 0);
            },
            children: t("discard")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "primary", disabled: !writable || staged === null, onClick: () => {
          void save();
        }, children: t("save") })
      ] })
    ] }),
    browsing ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      DirectoryBrowser,
      {
        t,
        onCancel: () => {
          setBrowsing(false);
        },
        onPickFile: (path) => {
          add(path);
          setBrowsing(false);
        },
        onPickDirectory: (path) => {
          add(path);
          setBrowsing(false);
        }
      }
    ) : null
  ] });
}
function LevelsPanel(props) {
  const { t, pickDirectory } = props;
  const [status, setStatus] = (0, import_react3.useState)("loading");
  const [state, setState] = (0, import_react3.useState)(void 0);
  const [failure, setFailure] = (0, import_react3.useState)(void 0);
  const [reload, setReload] = (0, import_react3.useState)(0);
  const [open, setOpen] = (0, import_react3.useState)(null);
  const [pending, setPending] = (0, import_react3.useState)(null);
  const [browsing, setBrowsing] = (0, import_react3.useState)(false);
  (0, import_react3.useEffect)(() => {
    const controller = new AbortController();
    setStatus("loading");
    setFailure(void 0);
    readState(controller.signal).then((next) => {
      if (controller.signal.aborted) return;
      setState(next);
      setStatus("ready");
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setFailure(error instanceof StateError ? error.code : String(error));
      setStatus("failed");
    });
    return () => {
      controller.abort();
    };
  }, [reload]);
  const write = async (body) => {
    try {
      const next = await writeState(body);
      setState(next);
      setStatus("ready");
      return void 0;
    } catch (error) {
      return error instanceof StateError ? error.code : "unknown";
    }
  };
  if (status === "loading") return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dfs-note", children: t("loading") });
  if (status === "failed") {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dfs-page", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: "dfs-note dfs-note-error", children: [
        t("loadFailed"),
        " \u2014 ",
        failure ?? "unknown"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dfs-buttons", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "outline", onClick: () => {
        setReload((value) => value + 1);
      }, children: t("retry") }) })
    ] });
  }
  if (state === void 0) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dfs-note", children: t("loading") });
  const projects = Object.entries(state.levels.projects).sort(([left], [right]) => left.localeCompare(right));
  const sessions = Object.entries(state.levels.sessions).sort(([left], [right]) => left.localeCompare(right));
  const extra = pending !== null && !(pending in state.levels.projects) ? pending : void 0;
  const pickProject = (path) => {
    setPending(path);
    setOpen(path);
    setBrowsing(false);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dfs-panel", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("header", { className: "dfs-panelHead", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.IconShieldOutlineRegular, { size: 20 }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h2", { className: "dfs-panelTitle", children: t("title") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dfs-note", children: t("panelIntro") }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "dfs-level", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dfs-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h4", { className: "dfs-heading", children: t("deploymentHeading") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Tag, { tone: "quiet", children: t("readOnlyShort") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dfs-note", children: t("deploymentNote") }),
      state.deployment.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dfs-note", children: t("deploymentEmpty") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { className: "dfs-rules", children: state.deployment.map((rule) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("li", { className: "dfs-rule", children: [
        isPattern2(rule) ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Tag, { tone: "neutral", children: t("kindPattern") }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("code", { className: "dfs-path", children: rule })
      ] }, rule)) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "dfs-level", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dfs-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h4", { className: "dfs-heading", children: t("globalHeading") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Tag, { tone: state.levels.global.length === 0 ? "neutral" : "info", children: state.levels.global.length === 0 ? t("summaryNone") : t("ruleCount", { count: state.levels.global.length }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dfs-note", children: t("globalNote") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        RuleEditor,
        {
          t,
          rules: state.levels.global,
          writable: true,
          onSave: (rules) => write({ scope: "global", rules })
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "dfs-level", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "dfs-head", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h4", { className: "dfs-heading", children: t("projectsHeading") }) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dfs-note", children: t("projectsNote") }),
      state.workspaces.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dfs-note", children: t("projectsNoWorkspace") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { className: "dfs-rules", children: state.workspaces.map((workspace) => {
        const has = workspace.path in state.levels.projects;
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "button",
          {
            type: "button",
            className: "dfs-row",
            onClick: () => {
              if (has) {
                setOpen(workspace.path);
                return;
              }
              pickProject(workspace.path);
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dfs-rowName", children: workspace.title }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("code", { className: "dfs-path", children: workspace.path }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Tag, { tone: has ? "info" : "quiet", children: has ? t("ruleCount", { count: state.levels.projects[workspace.path]?.length ?? 0 }) : t("projectUse") })
            ]
          }
        ) }, workspace.id);
      }) }),
      projects.length === 0 && extra === void 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dfs-note", children: t("projectsEmpty") }) : null,
      projects.map(([workspace, rules]) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dfs-levelRow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "button",
          {
            type: "button",
            className: "dfs-row",
            "aria-expanded": open === workspace,
            onClick: () => {
              setOpen(open === workspace ? null : workspace);
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("code", { className: "dfs-path dfs-path-grow", children: workspace }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Tag, { tone: "neutral", children: t("ruleCount", { count: rules.length }) }),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "dfs-hint", children: open === workspace ? t("collapse") : t("expand") })
            ]
          }
        ),
        open === workspace ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          RuleEditor,
          {
            t,
            rules,
            writable: true,
            onSave: (next) => write({ scope: "project", workspace, rules: next })
          }
        ) : null
      ] }, workspace)),
      extra === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dfs-levelRow", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dfs-row dfs-row-static", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("code", { className: "dfs-path dfs-path-grow", children: extra }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Tag, { tone: "warning", children: t("projectNew") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          RuleEditor,
          {
            t,
            rules: [],
            writable: true,
            onSave: async (next) => {
              const outcome = await write({ scope: "project", workspace: extra, rules: next });
              if (outcome === void 0) setPending(null);
              return outcome;
            }
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dfs-buttons", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Button, { variant: "outline", onClick: () => {
          setBrowsing(true);
        }, children: t("projectAdd") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          import_dsh_client_ui_primitives3.Button,
          {
            variant: "outline",
            disabled: pickDirectory === void 0,
            onClick: () => {
              void pickDirectory?.().then((picked) => {
                if (typeof picked === "string") pickProject(picked);
              });
            },
            children: t("addSystemDirectory")
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "dfs-level", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dfs-head", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("h4", { className: "dfs-heading", children: t("sessionsHeading") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Tag, { tone: "neutral", children: t("sessionTotal", { count: sessions.length }) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dfs-note", children: t("sessionsNote") }),
      sessions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "dfs-note", children: t("sessionsEmpty") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { className: "dfs-rules", children: sessions.map(([session, rules]) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("li", { className: "dfs-rule", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("code", { className: "dfs-path dfs-path-grow", children: session }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives3.Tag, { tone: "neutral", children: t("ruleCount", { count: rules.length }) })
      ] }, session)) })
    ] }),
    browsing ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      DirectoryBrowser,
      {
        t,
        onCancel: () => {
          setBrowsing(false);
        },
        onPickDirectory: (path) => {
          pickProject(path);
        },
        onPickFile: (path) => {
          const cut = path.lastIndexOf("/");
          pickProject(cut > 0 ? path.slice(0, cut) : path);
        }
      }
    ) : null
  ] });
}

// src/client/SessionShield.tsx
var import_dsh_client_ui_primitives4 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_react4 = require("react");
var import_jsx_runtime4 = require("react/jsx-runtime");
function SessionShieldView(props) {
  const { t, sessionId } = props;
  const [status, setStatus] = (0, import_react4.useState)("loading");
  const [rules, setRules] = (0, import_react4.useState)([]);
  const [cwd, setCwd] = (0, import_react4.useState)(null);
  const [failure, setFailure] = (0, import_react4.useState)(void 0);
  const [reload, setReload] = (0, import_react4.useState)(0);
  (0, import_react4.useEffect)(() => {
    const controller = new AbortController();
    setStatus("loading");
    setFailure(void 0);
    readState(controller.signal).then((state) => {
      if (controller.signal.aborted) return;
      setRules(state.levels.sessions[sessionId] ?? []);
      setStatus("ready");
    }).catch((error) => {
      if (controller.signal.aborted) return;
      setFailure(error instanceof StateError ? error.code : String(error));
      setStatus("failed");
    });
    readSessionCwd(sessionId, controller.signal).then((path) => {
      if (!controller.signal.aborted) setCwd(path);
    }).catch(() => {
      if (!controller.signal.aborted) setCwd(null);
    });
    return () => {
      controller.abort();
    };
  }, [sessionId, reload]);
  const save = async (next) => {
    try {
      const state = await writeState({ scope: "session", session: sessionId, rules: next });
      setRules(state.levels.sessions[sessionId] ?? []);
      return void 0;
    } catch (error) {
      return error instanceof StateError ? error.code : "unknown";
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dfs-panel", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("header", { className: "dfs-panelHead", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.IconShieldOutlineRegular, { size: 20 }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("h2", { className: "dfs-panelTitle", children: t("viewTab") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.Tag, { tone: "neutral", children: t("ruleCount", { count: rules.length }) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dfs-note", children: t("viewLead") }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dfs-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dfs-status", children: t("sessionCwd") }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { className: "dfs-path dfs-path-grow", children: cwd ?? t("sessionCwdUnknown") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dfs-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "dfs-status", children: "session" }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("code", { className: "dfs-path dfs-path-grow", children: sessionId })
    ] }),
    status === "loading" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "dfs-note", children: t("loading") }) : null,
    status === "failed" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "dfs-editor", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("p", { className: "dfs-note dfs-note-error", children: [
        t("loadFailed"),
        " \u2014 ",
        failure ?? "unknown"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "dfs-buttons", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives4.Button, { variant: "outline", onClick: () => {
        setReload((value) => value + 1);
      }, children: t("retry") }) })
    ] }) : null,
    status === "ready" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(RuleEditor, { t, rules, writable: true, onSave: save }) : null
  ] });
}

// src/client/locales.ts
var NS = "fileShield";
var zh = {
  title: "\u6587\u4EF6\u5C4F\u853D",
  panel: "\u6587\u4EF6\u5C4F\u853D",
  panelIntro: "\u5C4F\u853D\u89C4\u5219\u5206\u4E09\u7EA7\u53E0\u52A0\u751F\u6548\uFF1A\u90E8\u7F72\u9ED8\u8BA4\u3001\u5168\u5C40\u3001\u9879\u76EE\u3001\u4F1A\u8BDD\u540C\u65F6\u4F5C\u7528\u4E8E agent\u3002\u6BCF\u4E00\u6BB5\u53EA\u5199\u81EA\u5DF1\u90A3\u4E00\u5C42\uFF0C\u4E0D\u4F1A\u9876\u66FF\u5176\u4ED6\u5C42\u3002",
  summaryNone: "\u672A\u5C4F\u853D\u4EFB\u4F55\u6587\u4EF6",
  summaryCount: "\u5DF2\u5C4F\u853D {count} \u6761\u89C4\u5219",
  rulesHeading: "\u5DF2\u5C4F\u853D\u7684\u8DEF\u5F84",
  emptyRules: "\u8FD8\u6CA1\u6709\u89C4\u5219\u3002agent \u76EE\u524D\u53EF\u4EE5\u8BFB\u53D6\u5DE5\u4F5C\u533A\u5185\u7684\u4EFB\u4F55\u6587\u4EF6\u3002",
  addFile: "\u9009\u62E9\u6587\u4EF6\u2026",
  addDirectory: "\u9009\u62E9\u76EE\u5F55\u2026",
  addSystemDirectory: "\u7CFB\u7EDF\u76EE\u5F55\u9009\u62E9\u5668\u2026",
  manualPlaceholder: "\u8F93\u5165\u8DEF\u5F84\u6216 glob\uFF0C\u4F8B\u5982 **/.env",
  manualAdd: "\u6DFB\u52A0",
  remove: "\u79FB\u9664",
  overridden: "\u5DF2\u8986\u76D6\u90E8\u7F72\u9ED8\u8BA4",
  usingDefault: "\u4F7F\u7528\u90E8\u7F72\u9ED8\u8BA4",
  save: "\u4FDD\u5B58",
  saving: "\u6B63\u5728\u4FDD\u5B58\u2026",
  saved: "\u5DF2\u4FDD\u5B58",
  saveFailed: "\u4FDD\u5B58\u5931\u8D25\uFF0CHost \u672A\u63A5\u53D7\u8BE5\u503C",
  reset: "\u6062\u590D\u90E8\u7F72\u9ED8\u8BA4",
  discard: "\u64A4\u9500\u6539\u52A8",
  expand: "\u5C55\u5F00",
  collapse: "\u6536\u8D77",
  retry: "\u91CD\u8BD5",
  loading: "\u6B63\u5728\u8BFB\u53D6\u89C4\u5219\u2026",
  loadFailed: "\u65E0\u6CD5\u8BFB\u53D6\u5C4F\u853D\u72B6\u6001",
  unavailable: "Host \u672A\u63D0\u4F9B file-shield \u8BBE\u7F6E\uFF0C\u89C4\u5219\u6682\u4E0D\u53EF\u7F16\u8F91\u3002",
  readOnly: "\u5F53\u524D\u8FDE\u63A5\u4E0D\u5199\u5165 Host\uFF0C\u89C4\u5219\u53EA\u8BFB\u3002",
  readOnlyShort: "\u53EA\u8BFB",
  deploymentHeading: "\u90E8\u7F72\u9ED8\u8BA4",
  deploymentNote: "\u6765\u81EA\u90E8\u7F72\u7684 cordis.patch.yml\uFF0C\u53EA\u8BFB\uFF1B\u5728\u8FD9\u91CC\u65E0\u6CD5\u4FEE\u6539\u3002",
  deploymentEmpty: "\u90E8\u7F72\u6CA1\u6709\u9884\u8BBE\u4EFB\u4F55\u5C4F\u853D\u89C4\u5219\u3002",
  globalHeading: "\u5168\u5C40\u89C4\u5219",
  globalNote: "\u5BF9\u6240\u6709\u9879\u76EE\u4E0E\u4F1A\u8BDD\u751F\u6548\uFF0C\u4E0E\u9879\u76EE\u3001\u4F1A\u8BDD\u7EA7\u89C4\u5219\u53E0\u52A0\u3002",
  projectsHeading: "\u9879\u76EE\u89C4\u5219",
  projectsNote: "\u5BF9 dsh \u5DE5\u4F5C\u533A\u91CC\u7684\u67D0\u4E2A\u9879\u76EE\u751F\u6548\uFF1B\u4E00\u4E2A\u9879\u76EE\u4E00\u6BB5\u89C4\u5219\uFF0C\u4E0E\u5176\u4ED6\u5C42\u53E0\u52A0\u3002\u4E0B\u9762\u5217\u51FA\u7684\u662F\u8FD9\u4E2A\u5BBF\u4E3B\u5DF2\u6709\u7684\u5DE5\u4F5C\u533A\uFF0C\u4E5F\u53EF\u4EE5\u624B\u52A8\u52A0\u4E00\u4E2A\u6CA1\u767B\u8BB0\u7684\u76EE\u5F55\u3002",
  projectsEmpty: "\u8FD8\u6CA1\u6709\u9879\u76EE\u7EA7\u89C4\u5219\u3002",
  projectAdd: "\u9009\u62E9\u9879\u76EE\u76EE\u5F55\u2026",
  sessionsHeading: "\u4F1A\u8BDD\u89C4\u5219",
  sessionsNote: "\u4F1A\u8BDD\u7EA7\u89C4\u5219\u5728\u4F1A\u8BDD\u7684\u300C\u5C4F\u853D\u300D\u6807\u7B7E\u9875\u91CC\u914D\u7F6E\uFF0C\u8FD9\u91CC\u53EA\u505A\u6C47\u603B\u3002",
  sessionsEmpty: "\u6CA1\u6709\u4F1A\u8BDD\u7EA7\u89C4\u5219\u3002",
  ruleCount: "{count} \u6761\u89C4\u5219",
  sessionTotal: "{count} \u4E2A\u4F1A\u8BDD\u6709\u89C4\u5219",
  projectNew: "\u65B0\u76EE\u5F55\uFF1A\u4FDD\u5B58\u540E\u624D\u4F1A\u751F\u6548",
  projectUse: "\u9009\u4E2D",
  projectsNoWorkspace: "\u8FD9\u4E2A\u5BBF\u4E3B\u6CA1\u6709 dsh \u5DE5\u4F5C\u533A\u5217\u8868\uFF08\u7EC4\u5408\u91CC\u6CA1\u88C5 workspace \u5305\uFF09\uFF1B\u7528\u4E0B\u9762\u7684\u6D4F\u89C8\u6309\u94AE\u624B\u52A8\u9009\u76EE\u5F55\u3002",
  viewTab: "\u5C4F\u853D",
  viewLead: "\u8FD9\u4E2A\u4F1A\u8BDD\u7684\u89C4\u5219\u53EA\u4F5C\u7528\u4E8E\u5F53\u524D\u4F1A\u8BDD\uFF0C\u4E0E\u90E8\u7F72\u9ED8\u8BA4\u3001\u5168\u5C40\u3001\u9879\u76EE\u7EA7\u53E0\u52A0\u751F\u6548\u3002",
  sessionCwd: "\u5DE5\u4F5C\u533A",
  sessionCwdUnknown: "\u672A\u77E5",
  sessionNote: "\u672C\u4F1A\u8BDD\u7684\u89C4\u5219\u4E0E\u90E8\u7F72\u9ED8\u8BA4\u3001\u5168\u5C40\u3001\u9879\u76EE\u5C42\u53E0\u52A0\u751F\u6548\uFF0C\u4E0D\u4F1A\u9876\u66FF\u5B83\u4EEC\u3002",
  close: "\u5173\u95ED",
  browseTitle: "\u9009\u62E9\u8981\u5C4F\u853D\u7684\u6587\u4EF6",
  browseUp: "\u4E0A\u4E00\u7EA7",
  browseChooseDirectory: "\u5C4F\u853D\u5F53\u524D\u76EE\u5F55",
  browseEmpty: "\u8FD9\u4E2A\u76EE\u5F55\u662F\u7A7A\u7684",
  browseFailed: "\u65E0\u6CD5\u5217\u51FA\u8BE5\u76EE\u5F55",
  browseTruncated: "\u6761\u76EE\u8FC7\u591A\uFF0C\u53EA\u663E\u793A\u4E86\u4E00\u90E8\u5206",
  cancel: "\u53D6\u6D88",
  kindPattern: "\u89C4\u5219"
};
var en = {
  title: "File Shield",
  panel: "File Shield",
  panelIntro: "Shield rules apply in stacked levels: the deployment default, global, project, and session rules all reach the agent at once. Each section writes only its own level and never replaces another.",
  summaryNone: "No file is blocked",
  summaryCount: "{count} rule(s) blocked",
  rulesHeading: "Blocked paths",
  emptyRules: "No rules yet. The agent can read anything in the workspace.",
  addFile: "Pick a file\u2026",
  addDirectory: "Pick a directory\u2026",
  addSystemDirectory: "System directory picker\u2026",
  manualPlaceholder: "Path or glob, for example **/.env",
  manualAdd: "Add",
  remove: "Remove",
  overridden: "Overriding the deployment default",
  usingDefault: "Using the deployment default",
  save: "Save",
  saving: "Saving\u2026",
  saved: "Saved",
  saveFailed: "Save failed; the Host did not accept the value",
  reset: "Reset to deployment default",
  discard: "Discard changes",
  expand: "Expand",
  collapse: "Collapse",
  retry: "Retry",
  loading: "Reading rules\u2026",
  loadFailed: "Cannot read the shield state",
  unavailable: "The Host serves no file-shield settings, so the rules cannot be edited here.",
  readOnly: "This connection does not write to the Host; the rules are read-only.",
  readOnlyShort: "Read-only",
  deploymentHeading: "Deployment default",
  deploymentNote: "Comes from the deployment cordis.patch.yml and is read-only here.",
  deploymentEmpty: "The deployment presets no shield rules.",
  globalHeading: "Global rules",
  globalNote: "Applies to every project and session, stacked on the project and session rules.",
  projectsHeading: "Project rules",
  projectsNote: "Applies to one project inside a dsh workspace; one section per project, stacked with the other levels. The list below is this host's own workspaces; you can also add an unregistered directory.",
  projectsEmpty: "No project-level rules yet.",
  projectAdd: "Pick a project directory\u2026",
  sessionsHeading: "Session rules",
  sessionsNote: "Session rules are edited in the session's Shield tab; this is a summary.",
  sessionsEmpty: "No session-level rules.",
  ruleCount: "{count} rule(s)",
  sessionTotal: "{count} session(s) with rules",
  projectNew: "New directory: takes effect once saved",
  projectUse: "Select",
  projectsNoWorkspace: "This host exposes no dsh workspace list; pick a directory with the browser below.",
  viewTab: "Shield",
  viewLead: "Rules here apply to this session only; they stack with the deployment default, the global tier, and project tiers.",
  sessionCwd: "Workspace",
  sessionCwdUnknown: "unknown",
  sessionNote: "This session's rules stack on the deployment default, global, and project levels; they do not replace them.",
  close: "Close",
  browseTitle: "Pick a file to block",
  browseUp: "Up one level",
  browseChooseDirectory: "Block this directory",
  browseEmpty: "This directory is empty",
  browseFailed: "Cannot list this directory",
  browseTruncated: "Too many entries; only a part is shown",
  cancel: "Cancel",
  kindPattern: "Rule"
};

// src/client/index.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
var BUNDLE = "dsh-file-shield";
var ENTRY_ID = "file-shield";
var PANEL_ID = "file-shield";
var inject = ["slots", "locale"];
function injectStyles() {
  const tag = document.createElement("style");
  tag.dataset.plugin = BUNDLE;
  tag.textContent = page_default;
  document.head.appendChild(tag);
  return () => {
    tag.remove();
  };
}
function rulesForm(ctx) {
  return ctx.get("configForms")?.get(ENTRY_ID);
}
function pickDirectoryOf(ctx) {
  const workspace = ctx.get("uiWorkspace");
  return workspace === void 0 ? void 0 : () => workspace.pickDirectory();
}
function ShieldPanelIcon({ size }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives5.IconShieldOutlineRegular, { size });
}
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), "file-shield dictionaries");
  ctx.effect(() => injectStyles(), "file-shield styles");
  const t = ctx.locale.bind(NS);
  ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
    name: "plugins.bundle.config",
    key: BUNDLE,
    locale: NS,
    inject: () => ({
      form: rulesForm(ctx),
      pickDirectory: pickDirectoryOf(ctx)
    })
  }, FileShieldPage));
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: PANEL_ID,
    locale: NS,
    inject: () => ({ pickDirectory: pickDirectoryOf(ctx) })
  }, LevelsPanel));
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist",
    id: PANEL_ID,
    order: 30,
    locale: NS,
    label: () => t("panel")
  }, ShieldPanelIcon));
  ctx.slots.inject("conversation.view", () => ctx.slots.register({
    name: "conversation.view",
    id: "file-shield",
    order: 20,
    locale: NS,
    label: () => t("viewTab"),
    inject: (sessionId) => ({ sessionId })
  }, SessionShieldView));
}
return module.exports; } });
//# sourceMappingURL=client.js.map
