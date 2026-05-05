type Props = {
  toolbarId: string;
};

export function DocumentToolbar({ toolbarId }: Props) {
  return (
    <section className="toolbarShell toolbarShell--minimal">
      <div id={toolbarId} className="superdocToolbarMount" />
    </section>
  );
}
