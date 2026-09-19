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

// src/client/page.css
var page_default = "/*\n * File Shield \u9875\u9762\u6837\u5F0F\u3002\u7C7B\u540D\u5E26\u524D\u7F00\uFF0C\u56E0\u4E3A\u672C\u63D2\u4EF6\u4E0D\u5728 shell \u7684 CSS Modules\n * \u7BA1\u7EBF\u5185\uFF1B\u989C\u8272\u53D6\u81EA\u4E3B\u9898\u7684\u8BED\u4E49 token\uFF0C\n * \u9875\u9762\u56E0\u6B64\u8DDF\u968F\u6D45\u8272\u4E0E\u6DF1\u8272\u6A21\u5F0F\u3002\n */\n\n.dfs-page {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  font-size: 13px;\n  color: var(--dsw-alias-label-primary, inherit);\n}\n\n.dfs-head {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.dfs-heading {\n  margin: 0;\n  font-size: 13px;\n  font-weight: 600;\n}\n\n.dfs-note {\n  margin: 0;\n  color: var(--dsw-alias-label-caption, inherit);\n}\n\n.dfs-note-error {\n  color: var(--dsw-alias-label-error, inherit);\n}\n\n.dfs-rules {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  margin: 0;\n  padding: 0;\n  list-style: none;\n}\n\n.dfs-rule {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 4px 8px;\n  border: 1px solid var(--dsw-alias-border-l2, transparent);\n  border-radius: 8px;\n}\n\n.dfs-rule .dfs-path {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dfs-path {\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-size: 12px;\n}\n\n.dfs-actions {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.dfs-actions > :first-child {\n  flex: 1;\n  min-width: 0;\n}\n\n.dfs-foot {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  margin-top: 4px;\n}\n\n.dfs-status {\n  color: var(--dsw-alias-label-caption, inherit);\n}\n\n.dfs-browser {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  max-height: 45vh;\n  overflow-y: auto;\n}\n\n.dfs-crumbs {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.dfs-crumbs .dfs-path {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dfs-list {\n  display: flex;\n  flex-direction: column;\n  gap: 1px;\n  margin: 0;\n  padding: 0;\n  list-style: none;\n}\n\n.dfs-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  width: 100%;\n  padding: 5px 8px;\n  border: 0;\n  border-radius: 6px;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n\n.dfs-row:hover:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-hover, transparent);\n}\n\n.dfs-row:disabled {\n  cursor: default;\n  color: var(--dsw-alias-label-dimmed, inherit);\n}\n\n.dfs-rowName {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dfs-tag {\n  color: var(--dsw-alias-label-caption, inherit);\n  font-size: 11px;\n}\n";

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
  const { t, view, scope, pickDirectory } = props;
  const subscribe = (0, import_react2.useMemo)(() => (listener) => scope.subscribe(listener), [scope]);
  const snapshot = (0, import_react2.useSyncExternalStore)(subscribe, () => scope.getSnapshot(), () => scope.getSnapshot());
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
    await scope.set("deny", staged);
    const accepted = scope.getSnapshot().value?.deny;
    if (accepted !== void 0 && sameRules(accepted, staged)) {
      setStaged(null);
      setStatus("saved");
    } else {
      setStatus("failed");
    }
  };
  const reset = async () => {
    setStatus("saving");
    await scope.unset("deny");
    const layer = scope.getSnapshot().user;
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

// src/client/locales.ts
var NS = "fileShield";
var zh = {
  title: "\u6587\u4EF6\u5C4F\u853D",
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
  loading: "\u6B63\u5728\u8BFB\u53D6\u89C4\u5219\u2026",
  unavailable: "Host \u672A\u63D0\u4F9B file-shield \u8BBE\u7F6E\uFF0C\u89C4\u5219\u6682\u4E0D\u53EF\u7F16\u8F91\u3002",
  readOnly: "\u5F53\u524D\u8FDE\u63A5\u4E0D\u5199\u5165 Host\uFF0C\u89C4\u5219\u53EA\u8BFB\u3002",
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
  loading: "Reading rules\u2026",
  unavailable: "The Host serves no file-shield settings, so the rules cannot be edited here.",
  readOnly: "This connection does not write to the Host; the rules are read-only.",
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
var BUNDLE = "dsh-file-shield";
var SETTINGS_NAMESPACE = "file-shield";
var inject = ["slots", "settingsScope", "locale"];
function injectStyles() {
  const tag = document.createElement("style");
  tag.dataset.plugin = BUNDLE;
  tag.textContent = page_default;
  document.head.appendChild(tag);
  return () => {
    tag.remove();
  };
}
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { en, zh }), "file-shield dictionaries");
  ctx.effect(() => injectStyles(), "file-shield styles");
  const scope = ctx.settingsScope.bind({ namespace: SETTINGS_NAMESPACE });
  const workspace = ctx.get("uiWorkspace");
  ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
    name: "plugins.bundle.config",
    key: BUNDLE,
    locale: NS,
    inject: () => ({
      scope,
      pickDirectory: workspace === void 0 ? void 0 : () => workspace.pickDirectory()
    })
  }, FileShieldPage));
}
return module.exports; } });
//# sourceMappingURL=client.js.map
