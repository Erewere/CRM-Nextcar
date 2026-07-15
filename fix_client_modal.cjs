const fs = require('fs');
let content = fs.readFileSync('src/components/ClientDetailModal.tsx', 'utf8');

// 1. Add onUpdated to Props
const propsInterface = `interface Props {
  client: Client | Partial<Client>;
  initialStatus?: string;
  onClose: () => void;
}`;
const updatedPropsInterface = `interface Props {
  client: Client | Partial<Client>;
  initialStatus?: string;
  onClose: () => void;
  onUpdated?: () => void;
}`;
content = content.replace(propsInterface, updatedPropsInterface);

// 2. Add onUpdated to destructured props
const destructuredProps = `export function ClientDetailModal({
  client,
  initialStatus = "new",
  onClose,
}: Props) {`;
const updatedDestructuredProps = `export function ClientDetailModal({
  client,
  initialStatus = "new",
  onClose,
  onUpdated,
}: Props) {`;
content = content.replace(destructuredProps, updatedDestructuredProps);

// 3. Call onUpdated in handleSave
const onCloseCall = `      onClose();
    } catch (err) {`;
const updatedOnCloseCall = `      onUpdated?.();
      onClose();
    } catch (err) {`;
content = content.replace(onCloseCall, updatedOnCloseCall);

fs.writeFileSync('src/components/ClientDetailModal.tsx', content);
console.log('Fixed ClientDetailModal');
