export default {
  /** @param {import("./api").PluginContext} ctx */
  onload(ctx) {
    ctx.commands.register('hello', 'Say hello', () => ctx.ui.toast('Hello from a community plugin'));
    ctx.settings.registerPage('My plugin', (container) => {
      const label = document.createElement('label');
      label.textContent = 'Message ';
      const input = document.createElement('input');
      input.value = ctx.settings.get().message || 'Hello';
      input.onchange = () => { void ctx.settings.save({ message: input.value }); };
      label.append(input); container.append(label);
      return () => label.remove();
    });
  },
};
