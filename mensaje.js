(function() {
    'use strict';

    // 1. COMPROBACIÓN FULMINANTE: Bloqueo inmediato si la pastelería está brickeada
    if (localStorage.getItem('BakeryBricked') === 'true') {
        renderBrickedScreen();
        throw new Error("⚠️ [CRITICAL] Game execution halted: Bakery permanently bricked.");
    }

    function renderBrickedScreen() {
        if (!document.body) {
            window.addEventListener('DOMContentLoaded', renderBrickedScreen);
            return;
        }
        document.body.innerHTML = 
            '<div style="background:#050505; color:#ff3b30; text-align:center; padding:150px 20px; font-family:\'Courier New\', monospace; line-height:1.6; height: 100vh; box-sizing: border-box; user-select: none;">' +
            '<h1 style="font-size:40px; margin-bottom:20px; letter-spacing: 2px; text-shadow: 0 0 10px #ff3b30;">[ BREAD-LEVEL ANOMALY DETECTED ]</h1>' +
            '<p style="font-size:18px; color:#eaeaea;">The Ministry of Dough has permanently revoked your baking license.</p>' +
            '<p style="font-size:16px; color:#ffcc00; max-width:650px; margin:20px auto; padding: 15px; border: 1px solid #ffcc00; background: rgba(255,204,0,0.05);">' +
            'Reason: Mathematical inconsistency detected. Your cookie production rate or building assets do not align with your historical cookies baked.' +
            '</p>' +
            '<p style="font-size:14px; color:#666; margin-top:50px;">The grandmas have welded the bakery doors shut. Permanently.</p>' +
            '</div>';
    }

    function brickGame() {
        localStorage.setItem('BakeryBricked', 'true');
        
        if (typeof Game !== 'undefined' && Game.SaveTo) {
            localStorage.removeItem(Game.SaveTo);
        }
        localStorage.removeItem('CookieClickerGame');
        localStorage.removeItem('CookieClickerGameBeta');
        
        if (window.indexedDB && window.indexedDB.deleteDatabase) {
            window.indexedDB.deleteDatabase('CookieClicker');
        }

        renderBrickedScreen();
        throw new Error("🚨 [SECURITY BAN] Bakery permanently bricked due to exploitation.");
    }

    function notifyCheatAttempt(message) {
        if (typeof Game !== 'undefined' && Game.Notify) {
            Game.Notify(
                '<span style="color: #ff3333; font-weight: bold;">Security Alert!</span>',
                message,
                [10, 6],
                8
            );
        }
        if (typeof PlaySound === 'function') {
            PlaySound('snd/spellFail.mp3', 1);
        }
        console.warn("🛡️ [Anti-Cheat]: " + message);
    }

    function formatFullNumber(val, hasDecimals) {
        if (!isFinite(val)) return 'Infinity';
        if (val >= 1e15) {
            return typeof Beautify === 'function' ? Beautify(val, 2) : val.toExponential(2);
        }
        var fixed = hasDecimals ? val.toFixed(1) : Math.floor(val).toString();
        var parts = fixed.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return parts.join('.');
    }

    function performCalculationsCheck() {
        if (typeof Game === 'undefined' || !Game.ready) return true;
        if (Game.loading || Game.OnAscend || Game.ReincarnateTimer > 0) return true;

        var totalHistorical = Game.cookiesEarned + Game.cookiesReset;

        // Regla fundamental: Las galletas actuales nunca pueden superar las ganadas en esta ascensión
        if (Game.cookies > (Game.cookiesEarned + 1000)) {
            brickGame();
            return false;
        }

        // El saldo actual no puede superar el histórico absoluto registrado
        if (Game.cookies > (totalHistorical + 1000)) {
            brickGame();
            return false;
        }

        // Verificación de inconsistencia de CpS frente a producción histórica
        if (Game.cookiesPsRaw > 0 && Game.cookiesPsRaw > totalHistorical) {
            brickGame();
            return false;
        }

        return true;
    }

    var securityApplied = false; // Control de ejecución única

    function applySecurityOverrides() {
        if (securityApplied) return; // Evita re-declaraciones infinitas
        if (typeof Game === 'undefined' || !Game.ready) return;
        
        securityApplied = true;

        // 1. Interceptar Game.Popup
        var originalPopup = Game.Popup;
        Game.Popup = function(text, x, y) { 
            if (typeof Game.farmModeActive !== 'undefined' && Game.farmModeActive) {
                Game.LogFarmEvent(text);
                
                var cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                if (cleanText.toLowerCase().indexOf('lucky') !== -1 || cleanText.toLowerCase().indexOf('afortunado') !== -1) {
                    if (Game.farmFakeBuffs) {
                        Game.farmFakeBuffs.push({ name: "¡Lucky!", time: 5 * Game.fps });
                    }
                }
            }
            if (originalPopup) originalPopup(text, x, y);
        };

        // 2. Interceptar Game.Win
        var originalWin = Game.Win;
        Game.Win = function(what) {
            if (typeof what === 'string') {
                var achiev = Game.Achievements[what];
                if (achiev && achiev.won === 0 && typeof Game.farmModeActive !== 'undefined' && Game.farmModeActive) {
                    var achievName = achiev.shortName ? achiev.shortName : achiev.name;
                    var achievDesc = (achiev.desc || "").replace(/<[^>]*>/g, ' ').trim();
                    Game.LogFarmEvent("🏆 ¡LOGRO UNLOCKED!: " + achievName + " - " + achievDesc);
                }
            }
            if (originalWin) originalWin(what);
        };

        // 3. Interceptar Game.WriteSave
        var originalWriteSave = Game.WriteSave;
        Game.WriteSave = function(type) {
            var res = originalWriteSave(type);
            if (typeof Game.farmModeActive !== 'undefined' && Game.farmModeActive && !type) {
                Game.LogFarmEvent("💾 Autoguardado: Progreso salvado en el almacenamiento local.");
            }
            return res;
        };

        // 4. Blindaje Inmutable de Funciones de Truco
        const lockProperty = (obj, prop, valueFunc) => {
            var desc = Object.getOwnPropertyDescriptor(obj, prop);
            if (desc && !desc.configurable) return; // Si ya está bloqueada y no es configurable, omitimos
            
            try {
                Object.defineProperty(obj, prop, {
                    value: valueFunc,
                    writable: false,
                    configurable: false,
                    enumerable: true
                });
            } catch (e) {
                try {
                    obj[prop] = valueFunc;
                } catch (err) {}
            }
        };

        lockProperty(Game, 'OpenSesame', function() {
            notifyCheatAttempt("SESAME CLOSED! Absolute power corrupts the oven. Your cookies burned in the attempt.");
            return "Access denied by the dough deities.";
        });

        lockProperty(Game, 'RuinTheFun', function() {
            notifyCheatAttempt("Ruin the fun? Not on my watch. The grandmas are going on strike.");
            return "Fun saved.";
        });

        // 5. Restricción Dinámica y Blindada de Game.Earn
        var originalEarn = Game.Earn;
        try {
            Object.defineProperty(Game, 'Earn', {
                value: function(amount) {
                    if (!Game.loading && Game.ready && !Game.OnAscend) {
                        if (!isFinite(amount) || isNaN(amount)) {
                            notifyCheatAttempt("¡Inyección de valor infinito o corrupto en Game.Earn!");
                            brickGame();
                            return;
                        }

                        var currentCps = Math.max(0.1, Game.cookiesPs);
                        var baseLimit = 1e6; // Margen mínimo seguro
                        
                        var maxAllowed = baseLimit + (currentCps * 86400 * 2);
                        
                        var wrinklerExploding = false;
                        if (typeof Game.wrinklers !== 'undefined' && Game.wrinklers) {
                            for (var i in Game.wrinklers) {
                                var w = Game.wrinklers[i];
                                if (w && w.phase > 0 && w.hp <= 0.5) {
                                    if (amount <= w.sucked * 2.5) {
                                        wrinklerExploding = true;
                                        break;
                                    }
                                }
                            }
                        }
                        
                        if (wrinklerExploding) {
                            maxAllowed = amount + 100;
                        }
                        
                        if (amount > maxAllowed) {
                            notifyCheatAttempt("¡Inyección masiva detectada en Game.Earn!: " + formatFullNumber(amount, false));
                            brickGame();
                            return;
                        }
                    }
                    originalEarn(amount);
                },
                writable: false,
                configurable: false,
                enumerable: true
            });
        } catch (e) {
            console.error("🛡️ [Anti-Cheat]: Error aplicando descriptor inmutable a Game.Earn. Aplicando fallback básico...", e);
            Game.Earn = function(amount) {
                originalEarn(amount);
            };
        }

        // 6. Bloqueo de cambio de nombre de pastelería trampa
        var originalBakeryNameSet = Game.bakeryNameSet;
        Game.bakeryNameSet = function(name) {
            if (name.toLowerCase() === "saysopensesame" || name.toLowerCase().indexOf("saysopensesame") !== -1) {
                notifyCheatAttempt("Bloqueado intento de invocación de consola por cambio de nombre.");
                brickGame();
                return;
            }
            if (originalBakeryNameSet) originalBakeryNameSet(name);
        };

        // 7. Blindaje contra Hack de Velocidad (FPS)
        var currentFps = Game.fps || 30;
        try {
            Object.defineProperty(Game, 'fps', {
                get: function() {
                    return currentFps;
                },
                set: function(val) {
                    if (val === 30 || val === 60) {
                        currentFps = val;
                    } else {
                        notifyCheatAttempt("¡Manipulación de velocidad (FPS) detectada!: " + val);
                        currentFps = 30;
                        brickGame();
                    }
                },
                configurable: false,
                enumerable: true
            });

            Object.defineProperty(Game, 'baseFps', {
                value: 30,
                writable: false,
                configurable: false,
                enumerable: true
            });
        } catch (e) {
            console.error("🛡️ [Anti-Cheat]: No se pudo blindar el limitador de frames.", e);
        }

        // 8. Registro de lógica recurrente en el ciclo principal
        Game.registerHook('logic', function() {
            performCalculationsCheck();
        });

        console.log("%c🛡️ Centinela Anti-Cheat activo y blindado en el núcleo del juego.", "color: #ff3b30; font-weight: bold; font-size: 12px;");
    }

    function injectSentinel() {
        if (Game.Init && !Game.Init.isWrapped) {
            var originalInit = Game.Init;
            Game.Init = function() {
                originalInit();
                applySecurityOverrides();
            };
            Game.Init.isWrapped = true;
            console.log("🛡️ [Anti-Cheat]: Game.Init interceptado con éxito.");
        }
    }

    // Inicialización adaptativa con control de duplicados
    if (typeof Game !== 'undefined' && Game.ready) {
        applySecurityOverrides();
    } else {
        if (typeof Game !== 'undefined' && Game.Init) {
            injectSentinel();
        } else if (typeof Game !== 'undefined' && Game.Launch) {
            var originalLaunch = Game.Launch;
            Game.Launch = function() {
                originalLaunch();
                injectSentinel();
            };
        }
        
        var checkInterval = setInterval(function() {
            if (typeof Game !== 'undefined') {
                if (Game.ready) {
                    clearInterval(checkInterval);
                    applySecurityOverrides();
                } else if (Game.Init && !Game.Init.isWrapped) {
                    injectSentinel();
                }
            }
        }, 50);
    }
})();