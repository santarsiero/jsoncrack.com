import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Textarea, Group } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";
import useFile from "../../../store/useFile";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

// get a value from an object by a path like ["fruits", 0]
function getByPath(root: any, path: Array<string | number> = []) {
  if (!path || path.length === 0) return root;
  let curr = root;
  for (let i = 0; i < path.length; i++) {
    const k = path[i];
    if (curr == null) return undefined;
    curr = curr[k];
  }
  return curr;
}

// set a value inside an object by a path like ["fruits", 1]
function setByPath(root: any, path: Array<string | number> = [], value: unknown) {
  if (!path || path.length === 0) return value;
  let curr = root;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (curr[k] == null || typeof curr[k] !== "object") {
      const nextIsIndex = typeof path[i + 1] === "number";
      curr[k] = nextIsIndex ? [] : {};
    }
    curr = curr[k];
  }
  const last = path[path.length - 1];
  curr[last] = value;
  return root;
}

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const getJson = useJson(state => state.getJson);
  const setContents = useFile(state => state.setContents);
  
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<string>("");
  
  // preload the draft when modal opens
  React.useEffect(() => {
    if (opened && nodeData) {
      setIsEditing(false);
      setDraft(normalizeNodeData(nodeData.text ?? []));
    }
  }, [opened, nodeData]);
  
  const handleEdit = () => {
    setIsEditing(true);
  };
  
  const handleCancel = () => {
    setIsEditing(false);
    setDraft(normalizeNodeData(nodeData?.text ?? []));
  };
  
  const handleSave = () => {
    try {
      const full = JSON.parse(getJson());
      const path = nodeData?.path ?? [];
      const currentAtPath = getByPath(full, path as Array<string | number>);
    
      // parse the user edits (what you typed in the textarea)
      const edited = JSON.parse(draft || "{}");
    
      // shallow merge for plain objects, otherwise replace
      const isPlainObj = (v: any) => v && typeof v === "object" && !Array.isArray(v);
    
      const nextAtPath = (isPlainObj(currentAtPath) && isPlainObj(edited))
        ? { ...currentAtPath, ...edited }
        : edited;
    
      // write back into the full document and stringify
      const fullUpdated = setByPath(full, path as Array<string | number>, nextAtPath);
      const nextStr = JSON.stringify(fullUpdated, null, 2);
    
      // go through useFile so both left JSON and graph refresh
      setContents({ contents: nextStr, hasChanges: true });
    
      setIsEditing(false);
      onClose?.();
    } catch (e) {
      console.error("Invalid JSON while saving node edit", e);
    }
    
  };
    

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Group gap="xs">
              {!isEditing && (
                <Button size="xs" onClick={handleEdit}>
                  Edit
                </Button>
              )}
              {isEditing && (
                <>
                  <Button size="xs" color="green" onClick={handleSave}>
                    Save
                  </Button>
                  <Button size="xs" color="red" variant="light" onClick={handleCancel}>
                    Cancel
                  </Button>
                </>
              )}
              <CloseButton onClick={onClose} />
            </Group>
          </Flex>
          {!isEditing ? (
            <ScrollArea.Autosize mah={250} maw={600}>
              <CodeHighlight
                code={normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            </ScrollArea.Autosize>
          ) : (
            <Textarea
              autosize
              minRows={5}
              maxRows={12}
              miw={350}
              maw={600}
              value={draft}
              onChange={e => setDraft(e.currentTarget.value)}
              placeholder="Edit JSON for this node"
            />
          )}
        </Stack>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
