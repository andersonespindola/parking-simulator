# Simulador de Estacionamento — Especificação

Objetivo: treinar a noção de manobra, principalmente a ré (volante para um lado, traseira vai para o mesmo lado e a frente para o outro).

## Decisões

| Tema | Escolha |
|---|---|
| Plataforma | Navegador, Three.js + Vite (`npm run dev`) |
| Câmeras | 3D com várias vistas: de cima, terceira pessoa, dentro do carro, retrovisores (troca com tecla) |
| Controles | Teclado (setas/WASD) + volante desenhado na tela que gira de verdade e mostra as voltas |
| Câmbio | Sem câmbio: W/↑ frente, S/↓ ré, soltar para parar |
| Carro | Hatch compacto, ~4,0 m × 1,73 m, entre-eixos ~2,53 m |
| Ajudas | Sensor de estacionamento (bipes que aceleram perto de obstáculos) |
| Avaliação | Dois modos: treino livre e exame estilo Detran |

## Cenários

1. Baliza (paralela) entre dois carros, com meio-fio
2. Vaga a 90° de ré
3. Vaga a 45° (diagonal)
4. Garagem estreita

## Física (realismo)

- Modelo de bicicleta (Ackermann) com entre-eixos real; raio mínimo de giro ~5,2 m
- Volante com ~3 voltas de batente a batente, retorno lento e não automático
- Velocidade de manobra baixa; soltando as teclas o carro para
- Colisão por caixas orientadas (OBB) com carros, meio-fio, paredes e cones

## Exame (estilo Detran)

- Tempo limite e número máximo de ajustes (trocas de sentido)
- Falta grave: bater em carro/obstáculo. Falta: encostar no meio-fio, passar do tempo, ultrapassar o número de ajustes
- Ao final: distância do meio-fio, alinhamento (ângulo) e posição dentro da vaga, resultado aprovado/reprovado

## Fases de entrega

1. ✅ Projeto Vite, cena 3D, carro com física, volante na tela, câmeras, cenário da baliza
2. ✅ Sensor de estacionamento, colisões e o modo treino livre
3. ✅ Modo exame com pontuação
4. ✅ Demais cenários (90°, 45°, garagem)
