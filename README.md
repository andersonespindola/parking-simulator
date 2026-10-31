# Simulador de Estacionamento

Simulador 3D no navegador para treinar baliza e manobras de ré.

Cenários: baliza, vaga a 90° de ré (estacionamento de supermercado), vaga a 45° (de frente ou de ré) e garagem estreita (de ré pelo portão). Cada um tem três níveis de dificuldade, que mudam o tamanho da vaga ou do portão.

## Rodar

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente http://localhost:5173).

## Controles

| Tecla | Ação |
|---|---|
| W / ↑ | andar para frente |
| S / ↓ | dar ré (andando para frente, primeiro freia) |
| Espaço | freio forte |
| A D / ← → | girar o volante (ou arraste o volante na tela com o mouse) |
| C | trocar câmera (terceira pessoa, motorista com retrovisores, de cima, câmera de ré) |
| V / Z / X | olhar para trás / esquerda / direita (na vista do motorista) |
| T | linha de trajetória (desligada por padrão) |
| G | marcação da vaga |
| M | som |
| Enter | terminar e ver a avaliação |
| H | ajuda |
| Backspace | recomeçar |
| Esc | menu |

Não tem câmbio: soltando as teclas o carro para sozinho. No treino, parar dentro da vaga já mostra a avaliação; em qualquer momento, Enter avalia.

## Modo exame

Versão simplificada do exame do Detran (as regras mudam de estado para estado):

- 3 minutos e até 3 ajustes (trocas de sentido)
- Sem marcação da vaga e sem linha de trajetória
- Eliminatória (reprova na hora): bater, passar do tempo, terminar fora da vaga, entrar de frente onde era de ré
- Grave (3 pt): passar de 3 ajustes, ficar a mais de 50 cm do meio-fio (baliza)
- Média (2 pt): encostar a roda no meio-fio (cada vez)
- Leve (1 pt): terminar torto (mais de 5°)
- Reprova acima de 3 pontos. Aperte Enter na vaga para terminar.

Os últimos exames aparecem no menu (ficam salvos só neste navegador).

## Estrutura

- `src/car.js` — medidas do carro e física (modelo de bicicleta, frente/ré direto nas teclas)
- `src/carModel.js` — modelo 3D do carro
- `src/scenarios/` — cenários (cada um devolve obstáculos, vaga alvo e posição inicial)
- `src/cameras.js` — câmeras e retrovisores
- `src/sensor.js` — sensor de estacionamento e sons
- `src/hud.js` — volante na tela, câmbio, vista de cima com os sensores
- `src/exam.js` — regras, faltas e histórico do modo exame
- `src/main.js` — laço principal, colisões e avaliação
