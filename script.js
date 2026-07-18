document.addEventListener('DOMContentLoaded', () => {
  const displayElement = document.getElementById('display');
  const expressionPreview = document.getElementById('expressionPreview');
  const errorMessage = document.getElementById('errorMessage');
  const modeLabel = document.getElementById('modeLabel');
  const historyList = document.getElementById('historyList');
  const clearHistoryButton = document.getElementById('clearHistory');
  const themeToggleButton = document.getElementById('themeToggle');
  const copyResultButton = document.getElementById('copyResult');
  const keypad = document.querySelector('.keypad');

  const state = {
    currentInput: '0',
    previousValue: null,
    operator: null,
    waitingForOperand: false,
    lastExpression: '',
    lastResult: null,
    history: []
  };

  const operatorSymbols = {
    '+': '+',
    '-': '−',
    '*': '×',
    '/': '÷'
  };

  const soundContext = typeof window.AudioContext !== 'undefined' ? new AudioContext() : null;

  function formatNumber(value) {
    if (!Number.isFinite(value)) {
      return 'Error';
    }

    if (Object.is(value, -0)) {
      return '0';
    }

    const absValue = Math.abs(value);
    if ((absValue !== 0 && absValue < 1e-8) || absValue >= 1e12) {
      return value.toExponential(8).replace(/\.0+e/, 'e').replace(/(\.\d*?)0+e/, '$1e');
    }

    const rounded = Number.parseFloat(value.toFixed(10));
    return String(rounded);
  }

  function normalizeInput(value) {
    if (value === '-0') {
      return '0';
    }

    if (value.startsWith('0') && value.length > 1 && !value.startsWith('0.')) {
      return String(Number(value));
    }

    return value;
  }

  function currentValue() {
    return Number.parseFloat(state.currentInput);
  }

  function setError(message) {
    errorMessage.textContent = message;
    if (message) {
      modeLabel.textContent = 'Error';
    }
  }

  function clearError() {
    errorMessage.textContent = '';
    modeLabel.textContent = state.waitingForOperand ? 'Waiting for input' : 'Ready';
  }

  function updateDisplay() {
    displayElement.textContent = state.currentInput;

    if (state.operator && state.previousValue !== null) {
      expressionPreview.textContent = `${formatNumber(state.previousValue)} ${operatorSymbols[state.operator]} ${state.waitingForOperand ? '' : state.currentInput}`.trim();
    } else {
      expressionPreview.textContent = state.lastExpression;
    }

    if (!errorMessage.textContent) {
      modeLabel.textContent = state.waitingForOperand && state.operator ? 'Enter next value' : 'Ready';
    }
  }

  function playClickSound() {
    if (!soundContext) {
      return;
    }

    const oscillator = soundContext.createOscillator();
    const gain = soundContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 520;
    gain.gain.value = 0.02;

    oscillator.connect(gain);
    gain.connect(soundContext.destination);

    oscillator.start();
    oscillator.stop(soundContext.currentTime + 0.05);
  }

  function refreshTheme() {
    const storedTheme = localStorage.getItem('calculator-theme');
    const preferredTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    const theme = storedTheme || preferredTheme;

    document.documentElement.dataset.theme = theme;
    themeToggleButton.querySelector('.icon').textContent = theme === 'light' ? '◑' : '◐';
  }

  function toggleTheme() {
    const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem('calculator-theme', nextTheme);
    themeToggleButton.querySelector('.icon').textContent = nextTheme === 'light' ? '◑' : '◐';
  }

  function resetCalculator(keepHistory = true) {
    state.currentInput = '0';
    state.previousValue = null;
    state.operator = null;
    state.waitingForOperand = false;
    state.lastExpression = '';
    state.lastResult = null;

    if (!keepHistory) {
      state.history = [];
      renderHistory();
    }

    clearError();
    updateDisplay();
  }

  function appendDigit(digit) {
    if (state.waitingForOperand) {
      state.currentInput = digit;
      state.waitingForOperand = false;
      clearError();
      updateDisplay();
      return;
    }

    state.currentInput = state.currentInput === '0' ? digit : state.currentInput + digit;
    state.currentInput = normalizeInput(state.currentInput);
    clearError();
    updateDisplay();
  }

  function appendDecimal() {
    if (state.waitingForOperand) {
      state.currentInput = '0.';
      state.waitingForOperand = false;
      clearError();
      updateDisplay();
      return;
    }

    if (!state.currentInput.includes('.')) {
      state.currentInput += '.';
      clearError();
      updateDisplay();
    }
  }

  function handleBackspace() {
    if (state.waitingForOperand) {
      return;
    }

    if (state.currentInput.length <= 1 || (state.currentInput.length === 2 && state.currentInput.startsWith('-'))) {
      state.currentInput = '0';
    } else {
      state.currentInput = state.currentInput.slice(0, -1);
    }

    clearError();
    updateDisplay();
  }

  function applyPercent() {
    const value = currentValue();
    state.currentInput = formatNumber(value / 100);
    clearError();
    updateDisplay();
  }

  function startNegativeInput() {
    if (state.currentInput.startsWith('-')) {
      state.currentInput = state.currentInput.slice(1) || '0';
    } else if (state.currentInput === '0' || state.waitingForOperand) {
      state.currentInput = '-';
      state.waitingForOperand = false;
    } else {
      state.currentInput = `-${state.currentInput}`;
    }

    clearError();
    updateDisplay();
  }

  function calculate(firstValue, secondValue, operator) {
    switch (operator) {
      case '+':
        return firstValue + secondValue;
      case '-':
        return firstValue - secondValue;
      case '*':
        return firstValue * secondValue;
      case '/':
        if (secondValue === 0) {
          throw new Error('Division by zero');
        }
        return firstValue / secondValue;
      default:
        return secondValue;
    }
  }

  function commitHistory(expression, result) {
    state.history.unshift({ expression, result });
    state.history = state.history.slice(0, 8);
    renderHistory();
  }

  function renderHistory() {
    historyList.innerHTML = '';

    if (state.history.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'history-empty';
      emptyItem.textContent = 'No calculations yet';
      historyList.appendChild(emptyItem);
      return;
    }

    state.history.forEach((entry) => {
      const item = document.createElement('li');
      item.className = 'history-item';

      const expressionSpan = document.createElement('span');
      expressionSpan.className = 'history-expression';
      expressionSpan.textContent = entry.expression;

      const resultSpan = document.createElement('span');
      resultSpan.className = 'history-result';
      resultSpan.textContent = `= ${entry.result}`;

      item.append(expressionSpan, resultSpan);
      historyList.appendChild(item);
    });
  }

  function handleOperator(nextOperator) {
    if (nextOperator === '-') {
      if (state.waitingForOperand || (state.previousValue === null && state.currentInput === '0')) {
        startNegativeInput();
        return;
      }
    }

    if (state.currentInput === '-' && nextOperator !== '-') {
      return;
    }

    const inputValue = currentValue();

    if (state.previousValue === null) {
      state.previousValue = inputValue;
      state.operator = nextOperator;
      state.waitingForOperand = true;
      state.lastExpression = `${formatNumber(inputValue)} ${operatorSymbols[nextOperator]}`;
      clearError();
      updateDisplay();
      return;
    }

    if (state.waitingForOperand) {
      state.operator = nextOperator;
      state.lastExpression = `${formatNumber(state.previousValue)} ${operatorSymbols[nextOperator]}`;
      clearError();
      updateDisplay();
      return;
    }

    try {
      const result = calculate(state.previousValue, inputValue, state.operator);
      const formattedResult = formatNumber(result);
      const expression = `${formatNumber(state.previousValue)} ${operatorSymbols[state.operator]} ${formatNumber(inputValue)} = ${formattedResult}`;

      state.previousValue = result;
      state.currentInput = formattedResult;
      state.operator = nextOperator;
      state.waitingForOperand = true;
      state.lastExpression = `${formattedResult} ${operatorSymbols[nextOperator]}`;
      state.lastResult = formattedResult;

      commitHistory(expression, formattedResult);
      clearError();
      updateDisplay();
    } catch (error) {
      setError(error.message);
      state.previousValue = null;
      state.operator = null;
      state.waitingForOperand = false;
    }
  }

  function handleEquals() {
    if (state.operator === null || state.previousValue === null || state.waitingForOperand) {
      return;
    }

    const inputValue = currentValue();

    try {
      const result = calculate(state.previousValue, inputValue, state.operator);
      const formattedResult = formatNumber(result);
      const expression = `${formatNumber(state.previousValue)} ${operatorSymbols[state.operator]} ${formatNumber(inputValue)} = ${formattedResult}`;

      state.currentInput = formattedResult;
      state.previousValue = null;
      state.operator = null;
      state.waitingForOperand = false;
      state.lastExpression = expression;
      state.lastResult = formattedResult;

      commitHistory(expression, formattedResult);
      clearError();
      updateDisplay();
    } catch (error) {
      setError(error.message);
      state.previousValue = null;
      state.operator = null;
      state.waitingForOperand = false;
    }
  }

  function handleUnaryNegative() {
    startNegativeInput();
  }

  function handleButtonAction(action, value) {
    playClickSound();

    switch (action) {
      case 'digit':
        appendDigit(value);
        break;
      case 'decimal':
        appendDecimal();
        break;
      case 'operator':
        handleOperator(value);
        break;
      case 'equals':
        handleEquals();
        break;
      case 'clear':
        resetCalculator();
        break;
      case 'backspace':
        handleBackspace();
        break;
      case 'percent':
        applyPercent();
        break;
      default:
        break;
    }
  }

  function handleKeyboardInput(event) {
    const { key } = event;

    if (/^[0-9]$/.test(key)) {
      event.preventDefault();
      appendDigit(key);
      return;
    }

    if (key === '.') {
      event.preventDefault();
      appendDecimal();
      return;
    }

    if (key === '+' || key === '*' || key === '/') {
      event.preventDefault();
      handleOperator(key);
      return;
    }

    if (key === '-') {
      event.preventDefault();
      if (state.waitingForOperand || (state.previousValue === null && state.currentInput === '0')) {
        handleUnaryNegative();
      } else {
        handleOperator('-');
      }
      return;
    }

    if (key === 'Enter' || key === '=') {
      event.preventDefault();
      handleEquals();
      return;
    }

    if (key === 'Backspace') {
      event.preventDefault();
      handleBackspace();
      return;
    }

    if (key === 'Escape') {
      event.preventDefault();
      resetCalculator();
      return;
    }

    if (key === '%') {
      event.preventDefault();
      applyPercent();
    }
  }

  keypad.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) {
      return;
    }

    const { action, value, operator } = button.dataset;
    handleButtonAction(action, value || operator);
  });

  clearHistoryButton.addEventListener('click', () => {
    state.history = [];
    renderHistory();
    modeLabel.textContent = 'History cleared';
  });

  themeToggleButton.addEventListener('click', toggleTheme);
  copyResultButton.addEventListener('click', async () => {
    const textToCopy = state.currentInput;

    try {
      await navigator.clipboard.writeText(textToCopy);
      modeLabel.textContent = 'Result copied';
    } catch {
      modeLabel.textContent = 'Copy unavailable';
    }
  });

  document.addEventListener('keydown', handleKeyboardInput);
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (!localStorage.getItem('calculator-theme')) {
      refreshTheme();
    }
  });

  refreshTheme();
  resetCalculator();
});
